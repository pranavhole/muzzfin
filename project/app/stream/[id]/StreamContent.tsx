"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Stream } from "@/lib/types";
import MusicPlayer from "@/components/MusicPlayer";
import { SongQueue } from "@/components/SongQueue";
import { AddSongForm } from "@/components/AddSongForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Music, Users } from "lucide-react";
import axios from "axios";
import Link from "next/link";
import { io, Socket } from "socket.io-client";

export default function StreamContent() {
  const { id } = useParams<{ id: string }>();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();

  const [stream, setStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const isHost = user && stream ? user.id === stream.hostId : false;

  const socket = useRef<Socket | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  // === Fetch stream data ===
  useEffect(() => {
    if (!user || stream) return;

    const fetchStream = async () => {
      setIsLoading(true);
      try {
        const { data } = await axios.get(
          "http://localhost:5000/api/v1/streams",
          {
            params: { mode: "listen", streamId: id, userId: user.id },
          }
        );
        setStream(data);
      } catch (err) {
        console.error(err);
        toast({
          title: "Error",
          description: "Failed to load stream",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchStream();
  }, [id, user, stream, toast]);

  // === Initialize Socket.IO ===
  useEffect(() => {
    if (!user || !stream) return;
    if (socket.current) return;

    socket.current = io("http://localhost:5000", {
      transports: ["websocket"],
      reconnection: true,
    });

    const s = socket.current;

    s.on("connect", () => {
      // console.log("✅ Socket connected:", s.id);

      s.emit("message", {
        action: "join_stream",
        payload: {
          streamId: stream.id,
          userId: user.id,
          role: isHost ? "host" : "viewer",
        },
      });
    });

    const handleMessage = (msg: any) => {
      const packet = Array.isArray(msg) ? msg[0] : msg;
      const { action, data, payload, error } = packet;

      if (error) {
        toast({ title: "Error", description: error, variant: "destructive" });
        return;
      }

      switch (action) {
        case "song_added_broadcast":
          toast({ title: "Success", description: "Song added to queue" });
          setStream((updatedStream) =>
            updatedStream ? data.updatedStream : updatedStream
          );
          break;

        // 🔥 FIXED: match the actual event name
        case "song_skipped":
        case "song_skipped_broadcast":
          setStream((prev) => (prev ? data.updatedStream : prev));
          console.log(
            "✅ Song skipped, new current song:",
            data.updatedStream.currentSong
          );
          break;

        case "viewer_count":
          setStream((prev) =>
            prev ? { ...prev, listeners: payload.count } : prev
          );
          break;

        case "song_voted_broadcast":
          setStream((prev) =>
            prev ? { ...prev, queue: data.updatedQueue } : prev
          );
          break;
        case "play":
          setIsPlaying(true);
          break;

        case "pause":
          setIsPlaying(false);
          break;

        case "seek":
          setCurrentTime(payload.position);
          break;

        case "sync":
          setCurrentTime(payload.currentTime);
          setIsPlaying(payload.isPlaying);
          break;

        default:
          console.log("Unhandled action:", action);
      }
    };

    const handleHostDisconnect = () => {
      toast({
        title: "Stream ended",
        description: "Host disconnected",
        variant: "destructive",
      });
      setStream(null);
    };

    s.on("message", (msg: any) => {
      const packet = Array.isArray(msg) ? msg[0] : msg;
      handleMessage(packet);
    });
    s.on("host-disconnected", handleHostDisconnect);

    return () => {
      s.off("message", handleMessage);
      s.off("host-disconnected", handleHostDisconnect);
    };
  }, [user, stream, toast, isHost]);

  // === Helper to emit socket messages ===
  const sendSocketMessage = (action: string, payload: any = {}) => {
    if (!socket.current?.connected) {
      toast({
        title: "Error",
        description: "Socket not connected",
        variant: "destructive",
      });
      return;
    }
    socket.current.emit("message", { action, payload });
  };

  // === Queue handlers ===
  const handleAddSong = (url: string) => {
    if (!isAuthenticated || !stream) return;
    sendSocketMessage("add_song", {
      url,
      streamId: stream.id,
      userId: user?.id,
    });
  };

  const handleNextSong = () => {
    if (!isHost || !stream) return;
    sendSocketMessage("skip_song", { streamId: stream.id, userId: user?.id });
  };

  const handleVoteSong = (songId: string) => {
    if (!isAuthenticated || !stream) return;
    sendSocketMessage("vote_song", { songId, userId: user?.id });
  };

  const handleRemoveSong = (songId: string) => {
    if (!isAuthenticated || !stream) return;
    sendSocketMessage("remove_song", { streamId: stream.id, songId });
  };

  // === UI ===
  if (isLoading) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-16rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!stream) {
    return (
      <div className="container py-10">
        <Card>
          <CardContent className="flex flex-col items-center justify-center text-center py-12">
            <Music className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium">Stream not found</h3>
            <p className="text-muted-foreground mt-1 mb-4">
              The stream you’re looking for doesn’t exist or has ended
            </p>
            <Button asChild>
              <Link href="/streams">Browse Streams</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Stream header */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">
                {stream.title}
              </h1>
              <Badge
                variant="outline"
                className={
                  stream.isActive
                    ? "bg-green-500/20 text-green-500 border-green-500/50"
                    : ""
                }
              >
                {stream.isActive ? "Live" : "Ended"}
              </Badge>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {/* {stream.listeners} listening */}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src="" alt="Host" />
                  <AvatarFallback>H</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">
                  Hosted by {isHost ? "you" : "dj"}
                </span>
              </div>
            </div>
          </div>

          {/* Music player */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Now Playing</CardTitle>
            </CardHeader>
            <CardContent>
              <MusicPlayer
                stream={stream}
                isPlaying={isPlaying}
                currentTime={currentTime}
                onPlay={() =>
                  sendSocketMessage("play", { streamId: stream.id })
                }
                onPause={() =>
                  sendSocketMessage("pause", { streamId: stream.id })
                }
                onSkip={handleNextSong}
                onSeek={(time) => sendSocketMessage("seek", { position: time })}
              />
            </CardContent>
          </Card>

          {/* Add song form */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg">Add a Song</CardTitle>
              <CardDescription>
                Paste a YouTube, SoundCloud or Spotify link to add to the queue
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AddSongForm onAddSong={handleAddSong} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          <SongQueue
            songs={stream.queue}
            onVote={handleVoteSong}
            onRemove={isAuthenticated ? handleRemoveSong : undefined}
            className="h-full"
          />
        </div>
      </div>
    </div>
  );
}
