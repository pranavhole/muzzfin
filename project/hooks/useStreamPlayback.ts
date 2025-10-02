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
  const socket = useRef<Socket | null>(null);
  const lastSeekEmit = useRef<number>(0);
  const isJoined = useRef(false);

  // === Fetch stream data ===
  useEffect(() => {
    if (!userId || stream) return;

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
  }, [streamId, userId, stream]);

  // === Initialize socket ===
  useEffect(() => {
    if (!userId || !stream) return;
    if (socket.current) return;

    const s = io(`${process.env.NEXT_PUBLIC_BACKEND_URL}`, {
      transports: ["websocket"],
      reconnection: true,
    });

    socket.current = s;

    s.on("connect", () => {
      console.log("✅ Socket connected:", s.id);

      // join stream after connected
      s.emit("message", {
        action: "join_stream",
        payload: { streamId, userId, role: isHost ? "host" : "viewer" },
      });
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
        case "seek":
          setCurrentTime(payload.currentTime ?? payload.position ?? 0);
          if (audioRef.current)
            audioRef.current.currentTime = payload.currentTime ?? payload.position ?? 0;
          break;
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
        case "playback_state":
          setIsPlaying(payload.isPlaying);
          setCurrentTime(payload.currentTime);
          isJoined.current = true;
          break;
      }
    };

    s.on("message", handleMessage);

    return () => {
      s.off("message", handleMessage);
      s.disconnect();
    };
  }, [stream, userId, isHost, streamId, audioRef]);

  // === Audio sync ===
  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    if (isPlaying) audio.play().catch(console.error);
    else audio.pause();

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSeekEmit.current >= 3000) {
        lastSeekEmit.current = now;
        setCurrentTime(audio.currentTime);
      }
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => audio.removeEventListener("timeupdate", handleTimeUpdate);
  }, [isPlaying, audioRef]);

  // === Helper to emit socket messages safely ===
  const sendSocket = (action: string, payload: any = {}) => {
    if (!socket.current?.connected) {
      console.warn("Socket not connected yet");
      return;
    }
    if (!isJoined.current && action !== "join_stream") {
      console.warn("Stream not joined yet, cannot emit", action);
      return;
    }
    socket.current.emit("message", { action, payload });
  };

  // === Playback controls ===
  const play = () => sendSocket("play", { streamId });
  const pause = () => sendSocket("pause", { streamId });
  const seek = (time: number) => sendSocket("seek", { position: time });
  const skip = () => isHost && sendSocket("skip_song", { streamId, userId });

  // === Queue actions ===
  const addSong = (url: string) => sendSocket("add_song", { url, streamId, userId });
  const voteSong = (songId: string) => sendSocket("vote_song", { songId, userId });
  const removeSong = (songId: string) => sendSocket("remove_song", { songId, streamId });

  return { stream, isPlaying, currentTime, play, pause, seek, skip, addSong, voteSong, removeSong };
}
