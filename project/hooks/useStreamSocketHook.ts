import { useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { Stream } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

export function useStreamSocket({
  user,
  streamId,
  isHost,
  onUpdateStream,
  onStreamEnd,
}: {
  user: any;
  streamId: string | undefined;
  isHost: boolean;
  onUpdateStream: (updater: (prev: Stream | null) => Stream | null) => void;
  onStreamEnd: () => void;
}) {
  const { toast } = useToast();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user || !streamId) return;
    if (socketRef.current) return; // ✅ only connect once per streamId

    const s = io("http://localhost:5000", {
      transports: ["websocket"],
      reconnection: true,
    });
    socketRef.current = s;

    s.on("connect", () => {
      console.log("✅ Socket connected:", s.id);

      s.emit("message", {
        action: "join_stream",
        payload: {
          streamId,
          userId: user.id,
          role: isHost ? "host" : "viewer",
        },
      });
    });

    // Message handler
    const handleMessage = (msg: any) => {
      const { action, data, payload, error } = msg;
      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" });
        return;
      }

      switch (action) {
        case "song_added_broadcast":
          toast({ title: "Song Added", description: "Added to queue" });
          onUpdateStream((prev) =>
            prev ? { ...prev, queue: data.updatedQueue } : prev
          );
          break;

        case "skip_song_broadcast":
          onUpdateStream((prev) =>
            prev
              ? {
                  ...prev,
                  currentSong: data.nextSong,
                  queue: data.updatedQueue,
                }
              : prev
          );
          break;

        case "viewer_count":
          onUpdateStream((prev) =>
            prev ? { ...prev, listeners: payload.count } : prev
          );
          break;

        case "play":
          document.querySelector<HTMLAudioElement>("#listener-audio")?.play();
          break;

        case "pause":
          document.querySelector<HTMLAudioElement>("#listener-audio")?.pause();
          break;

        case "seek":
          const audio = document.querySelector<HTMLAudioElement>(
            "#listener-audio"
          );
          if (audio) audio.currentTime = payload.position;
          break;

        case "sync":
          const syncAudio = document.querySelector<HTMLAudioElement>(
            "#listener-audio"
          );
          if (syncAudio) {
            syncAudio.currentTime = payload.currentTime;
            payload.isPlaying ? syncAudio.play() : syncAudio.pause();
          }
          break;

        default:
          console.log("Unhandled socket action:", action);
      }
    };

    const handleHostDisconnect = () => {
      toast({
        title: "Stream ended",
        description: "Host disconnected",
        variant: "destructive",
      });
      onStreamEnd();
    };

    s.on("message", handleMessage);
    s.on("host-disconnected", handleHostDisconnect);

    return () => {
      s.off("message", handleMessage);
      s.off("host-disconnected", handleHostDisconnect);
      s.disconnect();
      socketRef.current = null;
    };
  }, [user, streamId, isHost, toast, onUpdateStream, onStreamEnd]);

  const sendMessage = useCallback(
    (action: string, payload: any) => {
      const s = socketRef.current;
      if (!s || !s.connected) {
        toast({
          title: "Error",
          description: "Socket not connected",
          variant: "destructive",
        });
        return;
      }
      s.emit("message", { action, payload });
    },
    [toast]
  );

  return { sendMessage };
}
