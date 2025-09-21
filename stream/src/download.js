import fs from "fs";
import path from "path";
import { Worker, Queue } from "bullmq";
import ytdl from "@distube/ytdl-core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { spawn } from "child_process";
import axios from "axios";
import pLimit from "p-limit"; // npm i p-limit

const connection = { host: "127.0.0.1", port: 6379 };

const s3 = new S3Client({
  region: "auto",
  endpoint: "https://aa59a684f4939becff5d771a785f9eca.r2.cloudflarestorage.com",
  credentials: {
    accessKeyId: "0e81c97a48c1fe621abb289bb2cab3e3",
    secretAccessKey:
      "926823340e9b0e58da2f35d42b6f4fe56d47326f84ec359307a19e922b1c13b2",
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
    const playlistUrl = `https://aa59a684f4939becff5d771a785f9eca.r2.cloudflarestorage.com/songs/${uuid}/${playlistName}`;
    await axios.put(`http://localhost:5000/api/v1/songs`, {
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
