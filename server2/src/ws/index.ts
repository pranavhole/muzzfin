import { Server as SocketIOServer, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { getYouTubeMetadata, getYouTubeVideoId } from "./handlers/addSong";
import { voteSongHandler } from "./handlers/voteSong";
import { removeSongHandler } from "./handlers/removeSong";
import { skipSongHandler } from "./handlers/skipSong";
import { createClient } from "redis";

const prisma = new PrismaClient();


const redisPub = createClient();
const redisSub = createClient();
const redisPubConnect = async () => await redisPub.connect();
const redisSubConnect = async () => await redisSub.connect();

redisPubConnect();
redisSubConnect();

const streamClients: Map<string, Set<string>> = new Map();

// Store playback state per stream
interface StreamPlaybackState {
  isPlaying: boolean;
  currentTime: number; // seconds
  lastUpdate: number; // timestamp in ms
}

// 🔹 Store state in Redis instead of local Map
async function setPlaybackState(streamId: string, state: StreamPlaybackState) {
  await redisPub.hSet(`playback:${streamId}`, {
    isPlaying: state.isPlaying ? "1" : "0",
    currentTime: state.currentTime.toString(),
    lastUpdate: state.lastUpdate.toString(),
  });
}

async function getPlaybackState(streamId: string): Promise<StreamPlaybackState | null> {
  const data = await redisPub.hGetAll(`playback:${streamId}`);
  if (!data || Object.keys(data).length === 0) return null;
  return {
    isPlaying: data.isPlaying === "1",
    currentTime: parseFloat(data.currentTime),
    lastUpdate: parseInt(data.lastUpdate),
  };
}

export function createSocketServer(server: any, prisma: PrismaClient) {
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
  });

  function broadcastToStream(streamId: string, message: any) {
    console.log("Broadcasting to stream", streamId, message.action);
    io.to(streamId).emit("message", message);
    redisPub.publish(`stream:${streamId}`, JSON.stringify(message)); // 🔹 publish
  }

  // 🔹 Listen to Redis for cross-instance sync
  redisSub.pSubscribe("stream:*", (msg:any, channel:any) => {
    const streamId = channel.split(":")[1];
    io.to(streamId).emit("message", JSON.parse(msg));
  });

  io.on("connection", (socket: Socket) => {
    console.log("🔗 Client connected:", socket.id);
    let joinedStreamId: string | null = null;

    socket.on("message", async ({ action, payload }: any) => {
      try {
        switch (action) {
          case "join_stream": {
            const { streamId, userId, role } = payload || {};
            joinedStreamId = streamId;

            if (!streamId || !userId) {
              socket.emit("message", { error: "❌ Missing streamId or userId" });
              return;
            }

            (socket as any).data = { role, streamId };
            if (!streamClients.has(streamId)) streamClients.set(streamId, new Set());
            streamClients.get(streamId)!.add(socket.id);
            socket.join(streamId);

            // Initialize playback state in Redis if not exists
            let state = await getPlaybackState(streamId);
            if (!state) {
              state = { isPlaying: false, currentTime: 0, lastUpdate: Date.now() };
              await setPlaybackState(streamId, state);
            }

            // Send current playback state to client
            socket.emit("message", { action: "playback_state", payload: state });

            broadcastToStream(streamId, {
              action: "viewer_count",
              payload: { count: streamClients.get(streamId)!.size },
            });
            break;
          }

          case "play": {
            if (!joinedStreamId) return;
            await setPlaybackState(joinedStreamId, { isPlaying: true, currentTime: 0, lastUpdate: Date.now() });
            broadcastToStream(joinedStreamId, { action: "play" });
            break;
          }

          case "pause": {
            if (!joinedStreamId) return;
            const state = await getPlaybackState(joinedStreamId);
            if (state) {
              state.isPlaying = false;
              state.lastUpdate = Date.now();
              await setPlaybackState(joinedStreamId, state);
            }
            broadcastToStream(joinedStreamId, { action: "pause" });
            break;
          }

          case "add_song": {
            const { url, streamId, userId } = payload;
            if (!url || !streamId || !userId) {
              socket.emit("message", {
                error: "⚠️ Missing url, streamId, or userId",
              });
              return;
            }

            try {
              const checkSong = await prisma.song.findFirst({
                where: { url, streamId },
              });

              if (checkSong) {
                socket.emit("message", {
                  error: "⚠️ Song already exists in this stream",
                });
                return;
              }
              const videoId = getYouTubeVideoId(url);
              if (!videoId) {
                socket.emit("message", { error: "⚠️ Invalid YouTube URL" });
                return;
              }

              const metadata = await getYouTubeMetadata(videoId);
              const result = await prisma.$transaction(async (tx:any) => {
                const newSong = await tx.song.create({
                  data: {
                    url,
                    title: metadata.title,
                    artist: metadata.artist,
                    thumbnail: metadata.thumbnail,
                    duration: metadata.duration,
                    addedAt: new Date(),
                    addedBy: { connect: { id: userId } },
                  },
                });

                const stream = await tx.stream.findUnique({
                  where: { id: streamId },
                  select: { currentSongId: true },
                });

                let updatedStream;
                if (!stream?.currentSongId) {
                  updatedStream = await tx.stream.update({
                    where: { id: streamId },
                    data: { currentSong: { connect: { id: newSong.id } } },
                    include: { currentSong: true, queue: true },
                  });
                } else {
                  updatedStream = await tx.stream.update({
                    where: { id: streamId },
                    data: { queue: { connect: { id: newSong.id } } },
                    include: { currentSong: true, queue: true },
                  });
                }

                return { newSong, updatedQueue: updatedStream.queue };
              });


              await redisPub.rPush(`queue:${streamId}`, JSON.stringify(result.newSong));

              socket.emit("message", { action: "song_added", data: result });
              broadcastToStream(streamId, {
                action: "song_added_broadcast",
                data: result,
              });
            } catch (error) {
              console.error("❌ Error creating song:", error);
              socket.emit("message", { error: "Failed to create song" });
            }
            break;
          }

          case "vote_song":
            await voteSongHandler(socket, payload, prisma, (msg) =>
              broadcastToStream(joinedStreamId!, msg)
            );
            break;

          case "remove_song":
            await removeSongHandler(socket, payload, prisma, (msg) =>
              broadcastToStream(joinedStreamId!, msg)
            );
            break;

          case "skip_song":
            await skipSongHandler(socket,payload, prisma, (msg) =>
              broadcastToStream(joinedStreamId!, msg)
            );
            break;

          default:
            socket.emit("message", { error: "❌ Unknown action" });
        }
      } catch (err) {
        console.error("Socket error:", err);
        socket.emit("message", { error: "❌ Internal server error" });
      }
    });

    socket.on("disconnect", () => {
      const { role, streamId } = (socket as any).data || {};
      if (role === "host" && streamId) io.to(streamId).emit("host-disconnected", { streamId });
      if (joinedStreamId) {
        const clients = streamClients.get(joinedStreamId);
        if (clients) {
          clients.delete(socket.id);
          broadcastToStream(joinedStreamId, {
            action: "viewer_count",
            payload: { count: clients.size },
          });
          if (clients.size === 0) streamClients.delete(joinedStreamId);
        }
      }
    });
  });

  return io;
}
