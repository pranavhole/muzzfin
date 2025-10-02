"use client";

import { useRef } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useStreamPlayback } from "@/hooks/useStreamPlayback";
import MusicPlayer from "@/components/MusicPlayer";
import { SongQueue } from "@/components/SongQueue";
import { AddSongForm } from "@/components/AddSongForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function StreamContent() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const audioRef = useRef<HTMLAudioElement>(null);
  const isHost = user && id ? true : false;

  const { stream, isPlaying, currentTime, play, pause, seek, skip, addSong, voteSong, removeSong } =
    useStreamPlayback(id, user?.id ?? "", isHost, audioRef);
  console.log(stream)
  if (!stream) return <div>Loading stream...</div>;

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
                onPlay={play}
                onPause={pause}
                onSkip={skip}
                onSeek={seek}
                host={isHost}
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
              <AddSongForm onAddSong={addSong} />
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1">
          {/* <SongQueue
            songs={stream.queue}
            onVote={handleVoteSong}
            onRemove={isAuthenticated ? handleRemoveSong : undefined}
            className="h-full"
          /> */}
          <SongQueue songs={stream.queue} onVote={voteSong} onRemove={isHost ? removeSong : undefined} className="h-full" />
        </div>
      </div>
    </div>
  );
}
