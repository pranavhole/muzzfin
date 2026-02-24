import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";

export async function removeSongHandler(
  ws: Socket,
  payload: any,
  prisma: PrismaClient,
  broadcast: (data: any) => void,
  ack?: (response: any) => void
) {
  const { songId } = payload;
  if (!songId) {
    ack?.({ error: "⚠️ Missing songId" });
    return;
  }

  try {
    await prisma.song.delete({ where: { id: songId } });
    ack?.({ success: true, songId });
    broadcast({ action: "song_removed_broadcast", songId });
  } catch (error) {
    console.error("❌ Error removing song:", error);
    ack?.({ error: "Failed to remove song" });
  }
}
