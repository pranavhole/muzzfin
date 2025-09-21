// socketServer.ts
import { Server as SocketIOServer, Socket } from "socket.io";
import { PrismaClient } from "@prisma/client";
import { getYouTubeMetadata, getYouTubeVideoId } from "./handlers/addSong";
import { voteSongHandler } from "./handlers/voteSong";
import { removeSongHandler } from "./handlers/removeSong";
import { skipSongHandler } from "./handlers/skipSong";
import axios from "axios";
const prisma = new PrismaClient();

// Keep track of clients per stream
const streamClients: Map<string, Set<string>> = new Map();

// Store playback state per stream
interface StreamPlaybackState {
  isPlaying: boolean;
  currentTime: number; // seconds
  lastUpdate: number; // timestamp in ms
}

const playbackStates: Map<string, StreamPlaybackState> = new Map();

export function createSocketServer(server: any, prisma: PrismaClient) {
  const io = new SocketIOServer(server, {
    cors: { origin: "*" },
  });

  function broadcastToStream(streamId: string, message: any) {
    console.log("Broadcasting to stream", streamId, message.action);
    io.to(streamId).emit("message", message);
  }

  // Update playback time every second for all streams
  setInterval(() => {
    playbackStates.forEach((state, streamId) => {
      if (state.isPlaying) {
        const now = Date.now();
        const delta = (now - state.lastUpdate) / 1000;
        state.currentTime += delta;
        state.lastUpdate = now;

        // Broadcast updated position to viewers
        broadcastToStream(streamId, {
          action: "sync",
          payload: { currentTime: state.currentTime, isPlaying: true },
        });
      }
    });
  }, 1000);

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
              socket.emit("message", {
                error: "❌ Missing streamId or userId",
              });
              return;
            }

            (socket as any).data = { role, streamId };
            if (!streamClients.has(streamId))
              streamClients.set(streamId, new Set());
            streamClients.get(streamId)!.add(socket.id);
            socket.join(streamId);

            // Initialize playback state if not exists
            if (!playbackStates.has(streamId)) {
              playbackStates.set(streamId, {
                isPlaying: false,
                currentTime: 0,
                lastUpdate: Date.now(),
              });
            }

            // Send current playback state to client
            const state = playbackStates.get(streamId)!;
            socket.emit("message", {
              action: "sync",
              payload: {
                currentTime: state.currentTime,
                isPlaying: state.isPlaying,
              },
            });

            broadcastToStream(streamId, {
              action: "viewer_count",
              payload: { count: streamClients.get(streamId)!.size },
            });
            break;
          }

          // Playback control actions
          case "play": {
            if (!joinedStreamId) return;
            const state = playbackStates.get(joinedStreamId)!;
            state.isPlaying = true;
            state.lastUpdate = Date.now();
            broadcastToStream(joinedStreamId, { action: "play" });
            break;
          }

          case "pause": {
            if (!joinedStreamId) return;
            const state = playbackStates.get(joinedStreamId)!;
            // Update currentTime before pausing
            const now = Date.now();
            state.currentTime += (now - state.lastUpdate) / 1000;
            state.isPlaying = false;
            state.lastUpdate = now;
            broadcastToStream(joinedStreamId, { action: "pause" });
            break;
          }

          case "seek": {
            if (!joinedStreamId) return;
            const { position } = payload;
            const state = playbackStates.get(joinedStreamId)!;
            state.currentTime = position;
            state.lastUpdate = Date.now();
            broadcastToStream(joinedStreamId, {
              action: "seek",
              payload: { position },
            });
            break;
          }

          // Song queue actions remain unchanged
          case "add_song": {
            console.log("hello");
            const { url, streamId, userId } = payload;
            if (!url || !streamId || !userId) {
              socket.emit("message", {
                error: "⚠️ Missing url, streamId, or userId",
              });
              return;
            }

            try {
              // Check duplicate
              let result;
              // Validate youtube link
              const videoId = getYouTubeVideoId(url);
              if (!videoId) {
                socket.emit("message", { error: "⚠️ Invalid YouTube URL" });
                return;
              }

              const metadata = await getYouTubeMetadata(videoId);

              // Transaction: add song + update stream
              result = await prisma.$transaction(async (tx) => {
                // 1️⃣ Check if download exists
                let download = await tx.downloadedSong.findUnique({
                  where: { url },
                });

                // 2️⃣ If not, create it
                if (!download) {
                  download = await tx.downloadedSong.create({
                    data: { url, path: "" },
                  });
                }

                // 3️⃣ Create the song and pin it to download
                const newSong = await tx.song.create({
                  data: {
                    url,
                    title: metadata.title,
                    artist: metadata.artist,
                    thumbnail: metadata.thumbnail,
                    duration: metadata.duration,
                    addedAt: new Date(),
                    addedBy: { connect: { id: userId } },

                    // ✅ Link song to downloadedSong
                    downloadedSong: {
                      connect: { id: download.id },
                    },
                  },
                });

                // 4️⃣ Handle stream logic
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
                axios.post(`http://localhost:4000`, { url: url });
                return { newSong, updatedQueue: updatedStream.queue };
              });

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
            await skipSongHandler(socket, payload, prisma, (msg) =>
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

    // Disconnect cleanup
    socket.on("disconnect", () => {
      const { role, streamId } = (socket as any).data || {};
      if (role === "host" && streamId)
        io.to(streamId).emit("host-disconnected", { streamId });
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
