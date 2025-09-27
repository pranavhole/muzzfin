import fs from "fs";
import path from "path";
import { Worker, Queue } from "bullmq";
import ytdl from "@distube/ytdl-core";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { spawn } from "child_process";
import axios from "axios";
import pLimit from "p-limit";

dotenv.config();

// ------------------------
// Redis Connection
// ------------------------
const redisConnection = process.env.REDIS_URL
  ? { url: process.env.REDIS_URL }
  : {
      host: process.env.REDIS_HOST || "127.0.0.1",
      port: Number(process.env.REDIS_PORT) || 6379,
      username: process.env.REDIS_USERNAME || undefined,
      password: process.env.REDIS_PASSWORD || undefined,
      ...(process.env.REDIS_TLS === "true" && { tls: {} }),
    };

console.log("🔗 Connecting to Redis:", redisConnection.url || `${redisConnection.host}:${redisConnection.port}`);

// ------------------------
// S3 Client
// ------------------------
const s3 = new S3Client({
  region: process.env.AWS_REGION,
  endpoint: process.env.AWS_ENDPOINT,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

// ------------------------
// Upload with retry
// ------------------------
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

// ------------------------
// Worker
// ------------------------
const worker = new Worker(
  "song-downloads",
  async (job) => {
    const { url } = job.data;
    console.log(`🎶 Downloading (HLS, ultra-fast) from: ${url}`);

    // Check if song exists
    try {
      const song = await axios.get(`${process.env.API_URL}/songs`, { params: { url } });
      if (song.data.path) {
        console.log("✅ Song already processed, skipping download.");
        return { url: song.data.songId };
      }
    } catch (err) {
      console.warn("⚠️ Failed to check existing song:", err.message);
    }

    const uuid = uuidv4();
    const basePath = path.join("downloads", uuid);
    const playlistName = "playlist.m3u8";
    fs.mkdirSync(basePath, { recursive: true });

    // ffmpeg HLS conversion
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn("ffmpeg", [
        "-y", "-i", "pipe:0", "-vn", "-c:a", "aac", "-b:a", "128k", "-ar", "44100", "-ac", "2",
        "-hls_time", "12", "-hls_list_size", "0", "-f", "hls", path.join(basePath, playlistName)
      ]);
      ytdl(url, { filter: "audioonly", quality: "highestaudio" }).pipe(ffmpeg.stdin);

      ffmpeg.on("close", (code) => code === 0 ? resolve(true) : reject(new Error(`ffmpeg exited ${code}`)));
    });
    console.log("✅ Converted to HLS");

    // Upload files concurrently
    const files = fs.readdirSync(basePath);
    const limit = pLimit(5);
    await Promise.all(files.map((file) => limit(() =>
      uploadWithRetry({
        Bucket: process.env.S3_BUCKET || "songs",
        Key: `${uuid}/${file}`,
        Body: fs.createReadStream(path.join(basePath, file)),
        ContentType: file.endsWith(".m3u8") ? "application/vnd.apple.mpegurl" : "video/mp2t",
      })
    )));

    // Cleanup
    files.forEach((file) => fs.unlinkSync(path.join(basePath, file)));
    fs.rmdirSync(basePath);

    // Save metadata
    const playlistUrl = `${process.env.AWS_ENDPOINT}/${process.env.S3_BUCKET}/${uuid}/${playlistName}`;
    try {
      await axios.put(`${process.env.API_URL}/songs`, { id: uuid, url });
    } catch (err) {
      console.warn("⚠️ Failed to save song metadata:", err.message);
    }

    return { url: playlistUrl };
  },
  {
    connection: redisConnection,
    lockDuration: 600_000,
    stalledInterval: 300_000,
  }
);

// Worker events
worker.on("completed", (job, result) => console.log(`🎉 Job ${job.id} completed:`, result.url));
worker.on("failed", (job, err) => console.error(`❌ Job ${job.id} failed:`, err));
worker.on("error", (err) => console.error("🚨 Worker error:", err));
worker.on("stalled", (job) => console.warn(`⚠️ Job ${job.id} stalled`));

// ------------------------
// Queue
// ------------------------
const songQueue = new Queue("song-downloads", { connection: redisConnection });

async function initQueue() {
  try {
    await songQueue.waitUntilReady();
    console.log("✅ Queue connected successfully to Redis");
  } catch (err) {
    console.error("❌ Queue failed to connect to Redis:", err);
    process.exit(1);
  }
}
initQueue();

// ------------------------
// Add Job Function
// ------------------------
export async function addSongDownloadJob(url) {
  try {
    const job = await songQueue.add(
      "download-song",
      { url },
      { removeOnComplete: true, removeOnFail: true }
    );
    console.log(`📥 Job added for: ${url} (Job ID: ${job.id})`);
    return job.id;
  } catch (err) {
    console.error("❌ Failed to add job:", err);
    throw err;
  }
}

// ------------------------
// Worker readiness
// ------------------------
(async () => {
  try {
    await worker.waitUntilReady();
    console.log("✅ Worker ready and listening for jobs");
  } catch (err) {
    console.error("❌ Worker failed to connect:", err);
    process.exit(1);
  }
})();
