import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";

export async function voteSongHandler(
  ws: Socket,
  payload: any,
  prisma: PrismaClient,
  broadcastToStream: (joinedStreamId: string, msg: any) => void,
  ack?: (response: any) => void
) {
  const { songId, userId } = payload;

  if (!songId || !userId) {
    ack?.({ error: "⚠️ Missing songId or userId" });
    return;
  }

  try {
    const song = await prisma.song.findUnique({
      where: { id: songId },
      include: { addedBy: true, votedBy: true },
    });

    if (!song) {
      ack?.({ error: "Song not found" });
      return;
    }

    if (song.addedById === userId) {
      ack?.({ error: "❌ You cannot vote for your own song" });
      return;
    }

    const alreadyVoted = song.votedBy.some((voter) => voter.id === userId);
    if (alreadyVoted) {
      ack?.({ error: "⚠️ You already voted for this song" });
      return;
    }
    const updatedSong = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { votedSongs: { connect: { id: songId } } },
      });

      return tx.song.update({
        where: { id: songId },
        data: { votedBy: { connect: { id: userId } } },
        include: { addedBy: true, votedBy: true },
      });
    });
    const id = updatedSong.streamId || "";
    const newQueue = await prisma.song.findMany({
      where: { streamId: song.streamId },
      include: { addedBy: true, votedBy: true },
      orderBy: [{ votedBy: { _count: "desc" } }, { addedAt: "asc" }],
    });

    ack?.({ success: true, data: newQueue });

    broadcastToStream(id, {
      action: "song_voted_broadcast",
      data: newQueue,
    });
  } catch (error) {
    console.error("❌ Error voting for song:", error);
    ack?.({ error: "Failed to record vote" });
  }
}
