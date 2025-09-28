import fs from "fs";
import path from "path";
import { Worker, Queue } from "bullmq";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { spawn } from "child_process";
import axios from "axios";
import pLimit from "p-limit";
import IORedis from "ioredis";
import ytDlp from "yt-dlp-exec";

dotenv.config();

// Redis connection
console.log("🔌 Connecting to Redis...");
const redisConnection = new IORedis(process.env.REDIS_URL, {
  maxRetriesPerRequest: null,
});
redisConnection.on("connect", () => console.log("✅ Redis connected"));
redisConnection.on("error", (err) => console.error("❌ Redis error:", err));

// S3 Client
console.log("☁️ Setting up S3 client...");
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// Upload with retry
async function uploadWithRetry(params, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      console.log(`⬆️ Uploading ${params.Key}, attempt ${i + 1}...`);
      await s3.send(new PutObjectCommand(params));
      console.log(`☁️ Uploaded: ${params.Key}`);
      return;
    } catch (err) {
      console.error(`⚠️ Upload failed for ${params.Key}, attempt ${i + 1}:`, err);
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

// Worker
console.log("⚙️ Starting worker...");
const worker = new Worker(
  "song-downloads",
  async (job) => {
    console.log(`🛠️ Worker picked job ${job.id} with data:`, job.data);

    const { url } = job.data;
    console.log(`🎶 Download job started: ${url}`);

    // Already processed?
    try {
      console.log("🔍 Checking API for existing record...");
      const song = await axios.get(process.env.API_URL, { params: { url } });
      if (song.data?.path) {
        console.log("✅ Already exists, skipping.");
        return { url: song.data.songId };
      }
    } catch (err) {
      console.warn("⚠️ API check failed:", err.message);
    }

    // Paths
    const uuid = uuidv4();
    const basePath = path.join("/tmp", uuid);
    console.log(`📂 Creating temp folder: ${basePath}`);
    fs.mkdirSync(basePath, { recursive: true });
    const tempFile = path.join(basePath, "audio.webm");

    // yt-dlp download (no re-encode)
    const ytArgs = {
      format: "bestaudio/best",
      output: tempFile,
      noPlaylist: true,
      verbose: true,
    };

    console.log("▶️ Running yt-dlp with args:", ytArgs);
    try {
      await ytDlp(url, ytArgs);
      console.log("✅ yt-dlp finished successfully");
    } catch (err) {
      console.error("❌ yt-dlp failed with error:", err);
      throw err;
    }

    // Convert to HLS with ffmpeg
    const playlistName = "playlist.m3u8";
    console.log("▶️ Starting ffmpeg HLS conversion...");
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-y",
          "-i", tempFile,
          "-vn",
          "-c:a", "aac",
          "-b:a", "128k",
          "-ar", "44100",
          "-ac", "2",
          "-af", "loudnorm",
          "-hls_time", "12",
          "-hls_list_size", "0",
          "-f", "hls",
          path.join(basePath, playlistName),
        ],
        { stdio: "inherit" }
      );

      ffmpeg.on("error", (err) => {
        console.error("❌ ffmpeg spawn failed:", err);
        reject(err);
      });

      ffmpeg.on("close", (code) => {
        console.log(`📀 ffmpeg exited with code ${code}`);
        code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}`));
      });
    });
    console.log("✅ HLS ready");

    // Upload files
    const filesToUpload = fs.readdirSync(basePath);
    console.log(`📤 Found ${filesToUpload.length} files to upload:`, filesToUpload);

    const limit = pLimit(5);

    await Promise.all(
      filesToUpload.map((file) =>
        limit(async () => {
          const filePath = path.join(basePath, file);

          // ✅ Read file into Buffer instead of streaming
          const fileData = await fs.promises.readFile(filePath);

          await uploadWithRetry({
            Bucket: process.env.S3_BUCKET,
            Key: `${uuid}/${file}`,
            Body: fileData,
            ContentType: file.endsWith(".m3u8")
              ? "application/vnd.apple.mpegurl"
              : "video/mp2t",
          });
        })
      )
    );


    // Cleanup
    console.log("🧹 Cleaning up temp files...");
    filesToUpload.forEach((file) => {
      try {
        fs.unlinkSync(path.join(basePath, file));
      } catch (e) {
        console.warn(`⚠️ Failed to delete file ${file}:`, e.message);
      }
    });
    try {
      fs.rmdirSync(basePath);
    } catch (e) {
      console.warn("⚠️ Failed to remove temp dir:", e.message);
    }
    console.log("🧹 Cleanup done");

    // Playlist URL
    const playlistUrl = `${process.env.S3_BASE_URL}/${uuid}/${playlistName}`;
    console.log(`🔗 Playlist URL generated: ${playlistUrl}`);

    // Save metadata
    try {
      console.log("💾 Saving metadata to API...");
      await axios.put(process.env.API_URL, { id: uuid, url });
      console.log("✅ Metadata saved");
    } catch (err) {
      console.error("⚠️ Metadata save failed:", err.message);
    }

    return { url: playlistUrl };
  },
  { connection: redisConnection, lockDuration: 600_000, stalledInterval: 300_000 }
);

worker.on("completed", (job, result) => console.log(`🎉 Job ${job.id} completed -> ${result.url}`));
worker.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed:`, err));

// Queue
console.log("📦 Creating queue...");
const songQueue = new Queue("song-downloads", { connection: redisConnection });

export async function addSongDownloadJob(url) {
  console.log(`📥 Adding job for URL: ${url}`);
  await songQueue.add("download-song", { url }, { removeOnComplete: true, removeOnFail: true });
  console.log(`✅ Job successfully queued for: ${url}`);
}
