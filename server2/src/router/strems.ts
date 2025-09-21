import { Router, Request, Response } from "express";
import { Prisma, PrismaClient } from "@prisma/client";
const router = Router();
const prisma = new PrismaClient();

router.route("/").get(async (req: Request, res: Response) => {
  const { mode, hostId, streamId, userId } = req.query;

  try {
    if (mode === "all") {
      const streams = await prisma.stream.findMany({
        include: { _count: { select: { listeners: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json(streams);
      return;
    }

    if (mode === "host") {
      if (!hostId) {
        res.status(400).json({ error: "Missing hostId" });
        return;
      }
      const streams = await prisma.stream.findMany({
        where: { hostId: hostId as string },
        include: { _count: { select: { listeners: true } } },
        orderBy: { createdAt: "desc" },
      });
      res.status(200).json(streams);
      return;
    }

    if (mode === "listen") {
      if (!userId || !streamId) {
        res.status(400).json({ error: "Missing userId or streamId" });
        return;
      }

      const updatedStream = await prisma.stream.update({
        where: { id: streamId as string },
        data: {
          listeners: { connect: { id: userId as string } }
        },
        include: {
          listeners: true,
          _count: { select: { listeners: true } },
          currentSong: true,
          host: true,
          queue: { include: { addedBy: true, _count: { select: { votedBy: true } } } },
        },
      });

      res.status(200).json(updatedStream);
      return;
    }

    // default fallback
    res.status(400).json({ error: "Invalid mode" });
    return;
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to fetch/update streams" });
  }
});

router.route("/").post(async (req: Request, res: Response) => {
  const { title, userId } = req.body;
  if (!title || !userId) {
    res.status(400).json({ error: "Missing title or userId in request body" });
    return;
  }
  console.log("Creating stream with title:", title, "for userId:", userId);
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    const stream = await prisma.stream.create({
      data: {
        title,
        host: { connect: { id: userId } },
        isActive: true,
      },
    });

    res.status(201).json(stream);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "Failed to create stream" });
  }
});

export const streamRouter = router;
