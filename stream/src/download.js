import fs from "fs";
import path from "path";
import { Worker, Queue } from "bullmq";
import ytdl from "@distube/ytdl-core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { spawn } from "child_process";
import axios from "axios";
import pLimit from "p-limit"; // npm i p-limit


dotenv.config();
const connection = process.env.REDIS_URL
  ? process.env.REDIS_URL
  : {
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    ...(process.env.REDIS_TLS === "true" && { tls: {} }),
  };
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});


// 🔄 Retry wrapper with exponential backoff
async function uploadWithRetry(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await s3.send(new PutObjectCommand(params));
      console.log(`☁️ Uploaded: ${params.Key}`);
      return;
    } catch (err) {
      console.error(
        `⚠️ Upload failed for ${params.Key}, attempt ${i + 1}:`,
        err.message
      );
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1))); // backoff
    }
  }
}

const worker = new Worker(
  "song-downloads",
  async (job) => {
    const { url } = job.data;
    console.log(`🎶 Downloading (HLS, ultra-fast) from: ${url}`);

    // ✅ check if song already exists
    const song = await axios.get(`http://localhost:5000/api/v1/songs/`, {
      params: { url },
    });
    if (song.data.path) {
      console.log("✅ Song already processed, skipping download.");
      return { url: song.data.songId };
    }

    const uuid = uuidv4();
    const basePath = path.join("downloads", uuid);
    const playlistName = "playlist.m3u8";

    fs.mkdirSync(basePath, { recursive: true });

    // 🎧 ffmpeg stream copy (no re-encode)
    const ffmpeg = spawn("ffmpeg", [
      "-y",
      "-i",
      "pipe:0",
      "-vn", // no video
      "-c:a",
      "aac", // ensure AAC audio
      "-b:a",
      "128k", // bitrate
      "-ar",
      "44100", // resample
      "-ac",
      "2", // stereo
      "-hls_time",
      "12",
      "-hls_list_size",
      "0",
      "-f",
      "hls",
      path.join(basePath, playlistName),
    ]);

    ytdl(url, { filter: "audioonly", quality: "highestaudio" }).pipe(
      ffmpeg.stdin
    );

    await new Promise((resolve, reject) => {
      ffmpeg.on("close", (code) => {
        code === 0 ? resolve(true) : reject(new Error(`ffmpeg exited ${code}`));
      });
    });

    console.log("✅ Converted to HLS (stream copy, ultra fast)");

    // ☁️ Upload with concurrency control
    const filesToUpload = fs.readdirSync(basePath);
    const limit = pLimit(5); // max 5 uploads at once

    await Promise.all(
      filesToUpload.map((file) =>
        limit(() =>
          uploadWithRetry({
            Bucket: "songs",
            Key: `${uuid}/${file}`,
            Body: fs.createReadStream(path.join(basePath, file)),
            ContentType: file.endsWith(".m3u8")
              ? "application/vnd.apple.mpegurl"
              : "video/mp2t",
          })
        )
      )
    );

    // 🧹 Cleanup
    filesToUpload.forEach((file) => fs.unlinkSync(path.join(basePath, file)));
    fs.rmdirSync(basePath);

    // 🔗 Save metadata
    const playlistUrl = `${process.env.AWS_ENDPOINT}/${process.env.S3_BUCKET}/${uuid}/${playlistName}`;
    await axios.put(process.env.API_URL, {
      id: uuid,
      url,
    });

    return { url: playlistUrl };
  },
  {
    connection,
    lockDuration: 600_000,
    stalledInterval: 300_000,
  }
);

worker.on("completed", (job, result) => {
  console.log(`🎉 Job ${job.id} completed:`, result.url);
});

worker.on("failed", (job, err) => {
  console.error(`❌ Job ${job.id} failed:`, err);
});

const songQueue = new Queue("song-downloads", { connection });

export async function addSongDownloadJob(url) {
  await songQueue.add(
    "download-song",
    { url },
    { removeOnComplete: true, removeOnFail: true }
  );
  console.log(`📥 Job added for: ${url}`);
}
