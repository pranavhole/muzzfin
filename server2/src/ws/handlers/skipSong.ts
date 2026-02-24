import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";

const prisma = new PrismaClient();

export async function skipSongHandler(
  ws: Socket,
  payload: any,
  prisma: PrismaClient,
  broadcast: (data: any) => void,
  ack?: (response: any) => void
) {
  try {
    const { streamId } = payload;
    if (!streamId) {
      ack?.({ error: "⚠️ Missing streamId" });
      return;
    }

    // Find stream with queue ordered by addedAt
    const stream = await prisma.stream.findUnique({
      where: { id: streamId },
      include: {
        queue: {
          orderBy: { addedAt: "asc" },
        },
      },
    });

    if (!stream) {
      ack?.({ error: "Stream not found" });
      return;
    }

    const nextSong = stream.queue[0]; // first in queue

    // Update stream: set currentSongId to next song
    // and remove it from the queue
    await prisma.stream.update({
      where: { id: streamId },
      data: {
        currentSongId: nextSong?.id || null,
        queue: nextSong
          ? {
              disconnect: { id: nextSong.id },
            }
          : undefined,
      },
    });
    const updatedStream = await prisma.stream.findUnique({
      where: { id: streamId },
      include: { queue: true },
    });
    const queue = updatedStream?.queue || [];

    ack?.({ success: true, data: { nextSong, updatedStream } });

    broadcast({
      action: "song_skipped_broadcast",
      data: { nextSong, updatedStream },
    });
  } catch (error) {
    console.error("skipSongHandler error:", error);
    ack?.({ error: "Failed to skip song" });
  }
}
