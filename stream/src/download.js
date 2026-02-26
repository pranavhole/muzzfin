import fs from "fs";
import path from "path";
import os from "os";
import crypto from "crypto";
import { Worker, Queue } from "bullmq";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import dotenv from "dotenv";
import { spawn } from "child_process";
import axios from "axios";
import pLimit from "p-limit";
import IORedis from "ioredis";
// yt-dlp-exec no longer used — calling yt-dlp directly via spawn

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

    const { url, streamId } = job.data;
    console.log(`🎶 Download job started: ${url}`);

    const emitProgress = (stage, percent) => {
      if (!streamId) return;
      try {
        redisConnection.publish(
          `progress:${streamId}`,
          JSON.stringify({ action: "download_progress", payload: { url, stage, percent } })
        );
      } catch (e) {
        console.warn("⚠️ Progress publish failed", e.message);
      }
    };

    // Already processed?
    const apiBase = process.env.API_URL?.startsWith("http")
      ? process.env.API_URL
      : process.env.API_URL
      ? `https://${process.env.API_URL}`
      : "";

    try {
      console.log("🔍 Checking API for existing record...");
      const song = await axios.get(apiBase, { params: { url } });
      if (song.data?.path) {
        console.log("✅ Already exists, skipping.");
        return { url: song.data.songId };
      }
    } catch (err) {
      console.warn("⚠️ API check failed:", err.message);
    }

    // Paths
    const uuid = uuidv4();
    const tmpRoot = process.env.TMP_DIR || os.tmpdir();
    const basePath = path.join(tmpRoot, uuid);
    console.log(`📂 Creating temp folder: ${basePath}`);
    fs.mkdirSync(basePath, { recursive: true });
    if (!fs.existsSync(basePath)) throw new Error(`Temp folder missing: ${basePath}`);
    const tempFilePattern = path.join(basePath, "audio.%(ext)s");
    emitProgress("queued", 0);

    // yt-dlp download (no re-encode) — using spawn for full CLI control
    const cookiesFile = path.resolve("/app/src/cookies.txt");
    const hasCookies = fs.existsSync(cookiesFile) && fs.statSync(cookiesFile).size > 100;

    const ytDlpBin = "/usr/bin/yt-dlp";
    const ytDlpArgs = [
      url,
      "--format", "bestaudio",
      "--output", tempFilePattern,
      "--no-playlist",
      "--prefer-free-formats",
      "--js-runtimes", "node",
      ...(hasCookies ? ["--cookies", cookiesFile] : []),
    ];
    console.log(`🍪 Cookies: ${hasCookies ? "loaded" : "not found, proceeding without"}`);
    console.log("▶️ Running yt-dlp:", ytDlpBin, ytDlpArgs.join(" "));

    const runYtDlp = () =>
      new Promise((resolve, reject) => {
        const proc = spawn(ytDlpBin, ytDlpArgs, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "", stderr = "";
        proc.stdout.on("data", (d) => { stdout += d; });
        proc.stderr.on("data", (d) => { stderr += d; });
        proc.on("error", reject);
        proc.on("close", (code) => {
          if (code === 0) return resolve(stdout);
          const err = new Error(`yt-dlp exited with code ${code}`);
          err.stderr = stderr.trim();
          err.stdout = stdout.trim();
          reject(err);
        });
      });

    const maxRetries = 3;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        emitProgress("downloading", 10);
        await runYtDlp();
        console.log("✅ yt-dlp finished successfully");
        break;
      } catch (err) {
        console.error(`❌ yt-dlp attempt ${attempt}/${maxRetries} failed:`, err.stderr || err.message);
        if (attempt === maxRetries) throw err;
        console.log(`⏳ Retrying in ${attempt * 2}s...`);
        await new Promise((r) => setTimeout(r, attempt * 2000));
      }
    }

    const downloadedFiles = fs.readdirSync(basePath);
    const audioFile = downloadedFiles.find((f) => f.startsWith("audio."));
    if (!audioFile) throw new Error("Downloaded file not found");
    const fullAudioPath = path.join(basePath, audioFile);
    emitProgress("downloaded", 50);

    // Convert to HLS with ffmpeg
    const playlistName = "playlist.m3u8";
    console.log("▶️ Starting ffmpeg HLS conversion...");
    await new Promise((resolve, reject) => {
      const ffmpeg = spawn(
        "ffmpeg",
        [
          "-y",
          "-i", fullAudioPath,
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
    emitProgress("converted", 70);

    // Upload files
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
          emitProgress("uploading", 70 + Math.floor((30 * filesToUpload.indexOf(file)) / filesToUpload.length));
        })
      )
    );
    emitProgress("uploaded", 95);

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
    emitProgress("ready", 100);

    // Save metadata
    try {
      console.log("💾 Saving metadata to API...", apiBase, { id: uuid, url });
      const resp = await axios.put(apiBase, { id: uuid, url });
      console.log("✅ Metadata saved:", resp.data);
    } catch (err) {
      console.error("⚠️ Metadata save failed:", err.message, err.response?.data || "");
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

export async function addSongDownloadJob(url, streamId) {
  console.log(`📥 Adding job for URL: ${url}`);
  const jobId = crypto.createHash("sha256").update(url).digest("hex").slice(0, 32);
  await songQueue.add(
    "download-song",
    { url, streamId },
    {
      jobId, // hashed URL — BullMQ forbids ':' in custom IDs
      removeOnComplete: true,
      removeOnFail: true,
    }
  );
  console.log(`✅ Job successfully queued for: ${url}`);
}
