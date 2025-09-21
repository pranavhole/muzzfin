import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";

export async function removeSongHandler(
  ws: Socket,
  payload: any,
  prisma: PrismaClient,
  broadcast: (data: string) => void
) {
  const { songId } = payload;
  if (!songId) {
    ws.send(JSON.stringify({ error: "⚠️ Missing songId" }));
    return;
  }

  await prisma.song.delete({ where: { id: songId } });

  ws.send(JSON.stringify({ action: "song_removed", songId }));
  broadcast(JSON.stringify({ action: "song_removed_broadcast", songId }));
}
