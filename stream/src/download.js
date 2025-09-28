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

const redisConnection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Utility: S3 upload with retry
async function uploadWithRetry(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await s3.send(new PutObjectCommand(params));
      console.log(`☁️ Uploaded: ${params.Key}`);
      return;
    } catch (err) {
      console.error(`⚠️ Upload failed for ${params.Key}, attempt ${i + 1}:`, err.message);
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

const worker = new Worker(
  'song-downloads',
  async (job) => {
    const { url } = job.data;
    console.log(`🎶 Downloading from: ${url}`);

    // Check if already processed
    const song = await axios.get(process.env.API_URL, { params: { url } });
    if (song.data.path) {
      console.log('✅ Already processed, skipping download.');
      return { url: song.data.songId };
    }

    const uuid = uuidv4();
    const basePath = path.join('/tmp', uuid); // safer on Railway
    const playlistName = 'playlist.m3u8';
    fs.mkdirSync(basePath, { recursive: true });

    const tempFile = path.join(basePath, 'audio.m4a');
    const cookiesPath = path.join(process.cwd(), 'cookies.txt');

    const ytArgs = {
      format: 'bestaudio/best',
      output: tempFile,
      audioFormat: 'aac',
      audioQuality: '5',
      quiet: false, // show logs for debugging
      postprocessorArgs: [
        '-ar', '44100',
        '-ac', '2',
        '-b:a', '128k',
        '-af', 'loudnorm'
      ],
    };

    if (fs.existsSync(cookiesPath)) {
      ytArgs.cookies = cookiesPath;
      console.log(`🍪 Using cookies from ${cookiesPath}`);
    } else {
      console.warn('⚠️ No cookies.txt found, may fail for age-restricted content.');
    }

    // Download audio
    await ytDlp(url, ytArgs);

    // Convert to HLS
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

      ffmpeg.on('close', (code) => code === 0 ? resolve(true) : reject(new Error(`ffmpeg exited ${code}`)));
    });

    console.log('✅ Converted to HLS');

    // Upload
    const filesToUpload = fs.readdirSync(basePath);
    const limit = pLimit(5);
    await Promise.all(filesToUpload.map((file) => 
      limit(() => uploadWithRetry({
        Bucket: process.env.S3_BUCKET,
        Key: `${uuid}/${file}`,
        Body: fs.createReadStream(path.join(basePath, file)),
        ContentType: file.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 'video/mp2t',
      }))
    ));

    // Cleanup
    filesToUpload.forEach(file => fs.unlinkSync(path.join(basePath, file)));
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    fs.rmdirSync(basePath);

    // Save metadata
    const playlistUrl = `${process.env.AWS_ENDPOINT}/${process.env.S3_BUCKET}/${uuid}/${playlistName}`;
    await axios.put(process.env.API_URL, { id: uuid, url });

    return { url: playlistUrl };
  },
  {
    connection: redisConnection,
    lockDuration: 600_000,
    stalledInterval: 300_000,
  }
);

worker.on('completed', (job, result) => {
  console.log(`🎉 Job ${job.id} completed:`, result.url);
});

worker.on('failed', (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});

const songQueue = new Queue('song-downloads', { connection: redisConnection });

export async function addSongDownloadJob(url) {
  await songQueue.add('download-song', { url }, { removeOnComplete: true, removeOnFail: true });
  console.log(`📥 Job added for: ${url}`);
}
