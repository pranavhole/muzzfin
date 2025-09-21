import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";

const prisma = new PrismaClient();

export async function skipSongHandler(
  ws: Socket,
  payload: any,
  prisma: PrismaClient,
  broadcast: (data: string) => void
) {
  try {
    const { streamId } = payload;
    if (!streamId) {
      ws.emit("message", { error: "⚠️ Missing streamId" });
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
      ws.emit("message", { error: "Stream not found" });
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

    ws.emit("message", {
      action: "song_skipped",
      data: { nextSong, updatedStream:updatedStream },
    });

    broadcast(
      JSON.stringify({
        action: "song_skipped_broadcast",
        data: { nextSong ,updatedStream:updatedStream },
      })
    );
  } catch (error) {
    console.error("skipSongHandler error:", error);
    ws.emit("message", { error: "Failed to skip song" });
  }
}
