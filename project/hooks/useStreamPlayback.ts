"use client";

import { useState, useEffect, useRef, RefObject } from "react";
import { Stream } from "@/lib/types";
import axios from "axios";
import { io, Socket } from "socket.io-client";

export function useStreamPlayback(
  streamId: string,
  userId: string,
  isHost: boolean,
  audioRef: RefObject<HTMLAudioElement>
) {
  const [stream, setStream] = useState<Stream | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [socketConnected, setSocketConnected] = useState(false);
  const [joined, setJoined] = useState(false);
  const [progress, setProgress] = useState<Record<string, { stage: string; percent: number }>>({});
  const socket = useRef<Socket | null>(null);
  const lastSeekEmit = useRef<number>(0);
  const isJoined = useRef(false);
  const joinedResolvers = useRef<Array<() => void>>([]);

  // === Fetch stream data ===
  useEffect(() => {
    if (!userId) return;

    const fetchStream = async () => {
      try {
        const { data } = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/streams`,
          { params: { mode: "listen", streamId, userId } }
        );
        setStream(data);
      } catch (err) {
        console.error("Failed to fetch stream", err);
      }
    };

    fetchStream();
  }, [streamId, userId]);

  // === Initialize socket ===
  // NOTE: NO stream/isHost in deps — socket must not reconnect on stream state updates
  useEffect(() => {
    if (!userId || !streamId) return;

    const s = io(`${process.env.NEXT_PUBLIC_BACKEND_URL}`, {
      transports: ["websocket"],
      reconnection: true,
    });

    socket.current = s;

    const doJoin = () => {
      s.emit(
        "message",
        { action: "join_stream", payload: { streamId, userId, role: isHost ? "host" : "viewer" } },
        (response: any) => {
          if (response?.error) {
            console.error("Join stream failed:", response.error);
          } else {
            console.log("✅ Joined stream");
            isJoined.current = true;
            setJoined(true);
            joinedResolvers.current.forEach((r) => r());
            joinedResolvers.current = [];
          }
        }
      );
    };

    s.on("connect", () => {
      console.log("✅ Socket connected:", s.id);
      setSocketConnected(true);
      isJoined.current = false; // reset before re-joining
      doJoin();
    });

    s.on("disconnect", () => {
      console.warn("❌ Socket disconnected");
      setSocketConnected(false);
      isJoined.current = false;
      setJoined(false);
    });

    s.on("connect_error", (err) => {
      console.error("Socket connection error:", err);
      setSocketConnected(false);
    });

    const handleMessage = (msg: any) => {
      const packet = Array.isArray(msg) ? msg[0] : msg;
      const { action, data, payload, error } = packet;
      if (error) return console.error("Socket error:", error);

      switch (action) {
        case "play":
          setIsPlaying(true);
          break;
        case "pause":
          setIsPlaying(false);
          break;
        case "seek": {
          const target = payload.currentTime ?? payload.position ?? 0;
          if (audioRef.current) {
            const diff = Math.abs(audioRef.current.currentTime - target);
            if (diff > 0.75) {
              audioRef.current.currentTime = target;
              setCurrentTime(target);
            }
          }
          break;
        }
        case "sync":
          setIsPlaying(payload.isPlaying);
          setCurrentTime(payload.currentTime);
          break;
        case "song_added_broadcast":
        case "song_skipped_broadcast":
        case "song_voted_broadcast":
          setStream((prev) =>
            prev
              ? {
                  ...prev,
                  queue: data.updatedQueue ?? prev.queue,
                  currentSong: data.updatedStream?.currentSong ?? prev.currentSong,
                }
              : prev
          );
          break;
        case "viewer_count":
          setStream((prev) => (prev ? { ...prev, listeners: payload.count } : prev));
          break;
        case "download_progress": {
          const { url, stage, percent } = payload;
          setProgress((p) => ({ ...p, [url]: { stage, percent } }));
          setStream((prev) =>
            prev
              ? {
                  ...prev,
                  queue: prev.queue.map((q) =>
                    q.url === url ? { ...q, progressStage: stage, progressPercent: percent } : q
                  ),
                  currentSong:
                    prev.currentSong && prev.currentSong.url === url
                      ? { ...prev.currentSong, progressStage: stage, progressPercent: percent }
                      : prev.currentSong,
                }
              : prev
          );
          break;
        }
        case "playback_state":
          setIsPlaying(payload.isPlaying);
          setCurrentTime(payload.currentTime);
          isJoined.current = true;
          setJoined(true);
          joinedResolvers.current.forEach((r) => r());
          joinedResolvers.current = [];
          console.log("✅ Playback state received, stream joined");
          break;
      }
    };

    s.on("message", handleMessage);

    return () => {
      s.off("message", handleMessage);
      s.off("connect");
      s.off("disconnect");
      s.off("connect_error");
      s.disconnect();
      socket.current = null;
      isJoined.current = false;
    };
  }, [userId, streamId]); // eslint-disable-line react-hooks/exhaustive-deps

  // === Audio time tracking (play/pause controlled by MusicPlayer) ===
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSeekEmit.current >= 3000) {
        lastSeekEmit.current = now;
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [audioRef]);

  // === Helper to emit socket messages with response ===
  const sendSocket = async (action: string, payload: any = {}): Promise<any> => {
    const s = socket.current;
    if (!s) {
      const error = "❌ Socket not initialized";
      console.error(error);
      throw new Error(error);
    }

    if (!s.connected) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("❌ Socket not connected. Waiting for connection...")), 5000);
        s.once("connect", () => {
          clearTimeout(timeout);
          resolve();
        });
        // Ensure a reconnect attempt is in flight
        s.connect();
      });
    }

    if (!isJoined.current && action !== "join_stream") {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("⚠️ Timed out waiting to join stream")), 8000);
        joinedResolvers.current.push(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }

    console.log(`📤 Sending ${action}:`, payload);

    return await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error(`⏱️ Timeout waiting for ${action} response`)), 10000);

      s.emit("message", { action, payload }, (response: any) => {
        clearTimeout(timeout);
        if (response?.error) {
          console.error(`❌ ${action} error:`, response.error);
          reject(new Error(response.error));
        } else {
          console.log(`✅ ${action} response:`, response);
          resolve(response);
        }
      });
    });
  };

  // === Playback controls ===
  const ensureHost = () => {
    if (!isHost) return Promise.reject(new Error("Only host can control playback"));
    return Promise.resolve();
  };

  const play = () => ensureHost().then(() => sendSocket("play", { streamId }));
  const pause = () => ensureHost().then(() => sendSocket("pause", { streamId }));
  const seek = (time: number) => ensureHost().then(() => sendSocket("seek", { position: time }));
  const skip = () => ensureHost().then(() => sendSocket("skip_song", { streamId, userId }));

  // === Queue actions ===
  const addSong = (url: string) => sendSocket("add_song", { url, streamId, userId });
  const voteSong = (songId: string) => sendSocket("vote_song", { songId, userId });
  const removeSong = (songId: string) => sendSocket("remove_song", { songId, streamId });

  return { stream, isPlaying, currentTime, socketConnected, joined, play, pause, seek, skip, addSong, voteSong, removeSong };
}
