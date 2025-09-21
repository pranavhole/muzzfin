import express from "express";
import cors from "cors";
import { addSongDownloadJob } from "./download.js";

const app = express();
app.use(cors());
app.use(express.json());

app.post("/", async (req, res) => {
  const { hostId, url } = req.body; // corrected from res.body to req.body

  if (!url) {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    await addSongDownloadJob(url);
    res.status(200).json({ message: "Job added successfully" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to add job" });
  }
});

app.listen(4000, () => {
  console.log("Server listening on port 4000");
});
