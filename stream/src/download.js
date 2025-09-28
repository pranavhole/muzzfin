import fs from 'fs';
import path from 'path';
import { Worker, Queue } from 'bullmq';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import axios from 'axios';
import pLimit from 'p-limit';
import IORedis from 'ioredis';
import ytDlp from 'yt-dlp-exec';

dotenv.config();

const redisConnection = new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// S3 upload with retry
async function uploadWithRetry(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await s3.send(new PutObjectCommand(params));
      console.log(`☁️ Uploaded: ${params.Key}`);
      return;
    } catch (err) {
      console.error(`⚠️ Upload failed for ${params.Key}, attempt ${i + 1}:`, err.message);
      if (i === retries - 1) throw err;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

function sanitizeUrl(url) {
  // strip playlist params like &list=, &start_radio=
  return url.split('&list=')[0].split('&start_radio=')[0];
}

async function runWithTimeout(promise, ms, errorMessage = '⏱️ Timeout') {
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => reject(new Error(errorMessage)), ms);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

const worker = new Worker(
  'song-downloads',
  async (job) => {
    let { url } = job.data;
    url = sanitizeUrl(url);
    console.log(`🎶 Starting download job for: ${url}`);

    // Check if already processed
    try {
      const song = await axios.get(process.env.API_URL, { params: { url } });
      if (song.data.path) {
        console.log('✅ Song already processed, skipping download.');
        return { url: song.data.songId };
      }
    } catch (err) {
      console.error('⚠️ Error checking API:', err.message);
    }

    const uuid = uuidv4();
    const basePath = path.join('/tmp', uuid);
    fs.mkdirSync(basePath, { recursive: true });
    console.log(`📂 Created temp folder: ${basePath}`);

    const tempFile = path.join(basePath, 'audio.m4a');
    const cookiesPath = 'cookies.txt';

    const ytArgs = {
      format: 'bestaudio/best',
      output: tempFile,
      audioFormat: 'aac',
      audioQuality: '5',
      postprocessorArgs: ['-ar', '44100', '-ac', '2', '-b:a', '128k', '-af', 'loudnorm'],
      noPlaylist: true, // 🚫 prevent playlist downloads
      quiet: false,
    };
    
    if (fs.existsSync(cookiesPath)) {
      ytArgs.cookies = cookiesPath;
      console.log(`🍪 Using cookies from ${cookiesPath}`);
    }

    console.log('▶️ Running yt-dlp...');
    try {
      await runWithTimeout(ytDlp(url, ytArgs), 5 * 60 * 1000, 'yt-dlp took too long');
      console.log('✅ yt-dlp finished successfully');
    } catch (err) {
      console.error('❌ yt-dlp failed:', err.message);
      throw err;
    }

    // Convert to HLS
    const playlistName = 'playlist.m3u8';
    console.log('▶️ Starting ffmpeg HLS conversion...');
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i', tempFile,
        '-vn',
        '-c:a', 'aac',
        '-b:a', '128k',
        '-ar', '44100',
        '-ac', '2',
        '-hls_time', '12',
        '-hls_list_size', '0',
        '-f', 'hls',
        path.join(basePath, playlistName),
      ], { stdio: 'inherit' });

      ffmpeg.on('close', (code) =>
        code === 0 ? resolve(true) : reject(new Error(`ffmpeg exited with code ${code}`))
      );
    });
    console.log('✅ HLS conversion done');

    // Upload files
    const filesToUpload = fs.readdirSync(basePath);
    const limit = pLimit(5);
    console.log(`📤 Uploading ${filesToUpload.length} files to S3...`);
    await Promise.all(filesToUpload.map(file =>
      limit(() =>
        uploadWithRetry({
          Bucket: process.env.S3_BUCKET,
          Key: `${uuid}/${file}`,
          Body: fs.createReadStream(path.join(basePath, file)),
          ContentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
        })
      )
    ));

    console.log('🧹 Cleaning up temp files...');
    filesToUpload.forEach(file => fs.unlinkSync(path.join(basePath, file)));
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    fs.rmdirSync(basePath);

    const playlistUrl = `${process.env.AWS_ENDPOINT}/${process.env.S3_BUCKET}/${uuid}/${playlistName}`;
    console.log(`🔗 Playlist URL: ${playlistUrl}`);

    // Save metadata
    try {
      await axios.put(process.env.API_URL, { id: uuid, url });
      console.log('✅ Metadata saved to API');
    } catch (err) {
      console.error('⚠️ Failed to save metadata:', err.message);
    }

    return { url: playlistUrl };
  },
  { connection: redisConnection, lockDuration: 600_000, stalledInterval: 300_000 }
);

worker.on('completed', (job, result) => console.log(`🎉 Job ${job.id} completed:`, result.url));
worker.on('failed', (job, err) => console.error(`❌ Job ${job.id} failed:`, err));

const songQueue = new Queue('song-downloads', { connection: redisConnection });

export async function addSongDownloadJob(url) {
  await songQueue.add('download-song', { url }, { removeOnComplete: true, removeOnFail: true });
  console.log(`📥 Job added for: ${url}`);
}
