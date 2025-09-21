// src/index.ts
import express from "express";
import cors from "cors";
import { createSocketServer } from "./ws/index";

import { streamRouter } from "./router/strems";
import { userRouter } from "./router/user";
import { playRouter } from "./router/play";
import { PrismaClient } from "@prisma/client";
import { songRouter } from "./router/songs";
const app = express();
app.use(cors());
app.use(express.json());
const prisma = new PrismaClient();
app.get("/health", (req: any, res: any) => res.send("ok"));
app.use("/api/v1/streams", streamRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/songs", songRouter);
app.use("/api/v1/play", playRouter);
const PORT = process.env.PORT ?? 5000;
const server=app.listen(PORT, () => console.log(`🚀 Server on http://localhost:${PORT}`));
createSocketServer(server, prisma);