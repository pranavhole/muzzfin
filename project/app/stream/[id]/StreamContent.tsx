"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Stream } from "@/lib/types";
import { getStream, addSongToStream, voteSong, removeSong, nextSong } from "@/lib/mock-data";
import { MusicPlayer } from "@/components/MusicPlayer";
import { SongQueue } from "@/components/SongQueue";
import { AddSongForm } from "@/components/AddSongForm";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Music, Users } from "lucide-react";

export default function StreamContent() {
  const { id } = useParams<{ id: string }>();
  const [stream, setStream] = useState<Stream | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const isHost = user && stream ? user.id === stream.hostId : false;

  useEffect(() => {
    if (id) {
      fetchStream();
    }
  }, [id]);

  const fetchStream = async () => {
    setIsLoading(true);
    try {
      const streamData = await getStream(id as string);
      setStream(streamData);
    } catch (error) {
      console.error("Error fetching stream:", error);
      toast({
        title: "Error",
        description: "Failed to load stream",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddSong = async (url: string) => {
    if (!isAuthenticated || !user || !stream) {
      toast({
        title: "Error",
        description: "You must be logged in to add songs",
        variant: "destructive",
      });
      return;
    }

    try {
      await addSongToStream(stream.id, url, user.id);
      toast({
        title: "Success",
        description: "Song added to queue",
      });
      await fetchStream(); // Refresh the stream data
    } catch (error) {
      console.error("Error adding song:", error);
      toast({
        title: "Error",
        description: "Failed to add song",
        variant: "destructive",
      });
    }
  };

  const handleVoteSong = async (songId: string) => {
    if (!isAuthenticated || !stream) {
      toast({
        title: "Error",
        description: "You must be logged in to vote",
        variant: "destructive",
      });
      return;
    }

    try {
      await voteSong(stream.id, songId);
      await fetchStream(); // Refresh the stream data
    } catch (error) {
      console.error("Error voting for song:", error);
      toast({
        title: "Error",
        description: "Failed to vote for song",
        variant: "destructive",
      });
    }
  };

  const handleRemoveSong = async (songId: string) => {
    if (!isAuthenticated || !user || !stream) return;

    try {
      await removeSong(stream.id, songId);
      toast({
        title: "Success",
        description: "Song removed from queue",
      });
      await fetchStream(); // Refresh the stream data
    } catch (error) {
      console.error("Error removing song:", error);
      toast({
        title: "Error",
        description: "Failed to remove song",
        variant: "destructive",
      });
    }
  };

  const handleNextSong = async () => {
    if (!isHost || !stream) return;

    try {
      const next = await nextSong(stream.id);
      if (next) {
        toast({
          title: "Next Song",
          description: `Now playing: ${next.title}`,
        });
      } else {
        toast({
          title: "Queue Empty",
          description: "There are no more songs in the queue",
        });
      }
      await fetchStream(); // Refresh the stream data
    } catch (error) {
      console.error("Error skipping to next song:", error);
      toast({
        title: "Error",
        description: "Failed to skip to next song",
        variant: "destructive",
      });
    }
  };

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
              The stream you're looking for doesn't exist or has ended
            </p>
            <Button asChild>
              <a href="/streams">Browse Streams</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="flex flex-col gap-6">
            {/* Stream header */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold tracking-tight">{stream.title}</h1>
                <Badge variant="outline" className={stream.isActive ? "bg-green-500/20 text-green-500 border-green-500/50" : ""}>
                  {stream.isActive ? "Live" : "Ended"}
                </Badge>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{stream.listeners} listening</span>
                </div>
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarImage src="" alt="Host" />
                    <AvatarFallback>H</AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground">Hosted by {isHost ? "you" : "DJ"}</span>
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
                  currentSong={stream.currentSong} 
                  onEnded={isHost ? handleNextSong : undefined}
                  isHost={isHost}
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
        </div>
        
        {/* Song queue */}
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