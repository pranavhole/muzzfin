// streamRoutes.ts
import express from "express";
import { Prisma, PrismaClient } from "@prisma/client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { S3Client } from "@aws-sdk/client-s3";

const prisma = new PrismaClient();
export const r2 = new S3Client({
   region: "auto",
    endpoint: "https://aa59a684f4939becff5d771a785f9eca.r2.cloudflarestorage.com",
    credentials: {
      accessKeyId:"0e81c97a48c1fe621abb289bb2cab3e3",
      secretAccessKey: "926823340e9b0e58da2f35d42b6f4fe56d47326f84ec359307a19e922b1c13b2",
    },
});


const router = express.Router();
const BUCKET = "songs";

// Playlist request
router.get("/:songId/playlist.m3u8", async (req, res) => {
  try {
    const { songId } = req.params;
    const key = `${songId}/playlist.m3u8`;

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await r2.send(command);

    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");

    if (response.Body) {
      (response.Body as any).pipe(res);
    } else {
      res.status(404).json({ error: "File not found" });
    }
  } catch (err) {
    console.error("❌ Error fetching playlist:", err);
    res.status(500).json({ error: "Failed to fetch playlist" });
  }
});
router.get("/ready/:songId", async (req, res) => {
  const { songId } = req.params;
  // Here you would typically check if the song is ready in your database or storage
  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) {
    res.status(404).json({ error: "Song not found" });
    return;
  }
  const downlaod = await prisma.downloadedSong.findUnique({ where: { url: song.url } });
  if (!downlaod) {
    res.status(404).json({ error: "Song not found" });
    return;
  }

  if (downlaod.path) {
    res.status(200).json({ ready: true ,id: downlaod.path});
  } else {
    res.status(202).json({ ready: false });
  }
});
// Segment request
router.get("/:songId/:segment", async (req, res) => {
  try {
    const { songId, segment } = req.params;
    const key = `${songId}/${segment}`;

    const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const response = await r2.send(command);

    res.setHeader("Content-Type", "video/mp2t");

    if (response.Body) {
      (response.Body as any).pipe(res);
    } else {
      res.status(404).json({ error: "Segment not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch segment" });
  }
});



export const playRouter = router; 