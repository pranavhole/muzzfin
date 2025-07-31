"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { Stream } from "@/lib/types";
import { createStream, getStreams } from "@/lib/mock-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { StreamCard } from "@/components/StreamCard";
import { PlusCircle, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DashboardPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newStreamTitle, setNewStreamTitle] = useState("");
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (isAuthenticated) {
      fetchStreams();
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchStreams = async () => {
    setIsLoading(true);
    try {
      const allStreams = await getStreams();
      // Filter streams created by the current user
      const userStreams = user ? allStreams.filter(stream => stream.hostId === user.id) : [];
      setStreams(userStreams);
    } catch (error) {
      console.error("Error fetching streams:", error);
      toast({
        title: "Error",
        description: "Failed to load your streams",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateStream = async () => {
    if (!newStreamTitle.trim()) {
      toast({
        title: "Error",
        description: "Please enter a stream title",
        variant: "destructive",
      });
      return;
    }
    
    setIsCreating(true);
    try {
      if (!user) throw new Error("User not authenticated");
      
      const newStream = await createStream(newStreamTitle.trim(), user.id);
      setStreams([newStream, ...streams]);
      setNewStreamTitle("");
      
      toast({
        title: "Success",
        description: "Stream created successfully",
      });
      
      // Navigate to the new stream
      router.push(`/stream/${newStream.id}`);
    } catch (error) {
      console.error("Error creating stream:", error);
      toast({
        title: "Error",
        description: "Failed to create stream",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  if (authLoading) {
    return (
      <div className="container flex items-center justify-center min-h-[calc(100vh-16rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Create and manage your music streams
          </p>
        </div>

        {/* Create new stream */}
        <Card>
          <CardHeader>
            <CardTitle>Create a New Stream</CardTitle>
            <CardDescription>
              Start a new music stream and invite listeners to join
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <Input
                placeholder="Enter stream title"
                value={newStreamTitle}
                onChange={(e) => setNewStreamTitle(e.target.value)}
                disabled={isCreating}
              />
              <Button onClick={handleCreateStream} disabled={isCreating}>
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PlusCircle className="h-4 w-4 mr-2" />
                )}
                {isCreating ? "Creating..." : "Create Stream"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* User's streams */}
        <div className="flex flex-col gap-4">
          <h2 className="text-xl font-semibold">Your Streams</h2>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : streams.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center text-center py-12">
                <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium">No streams yet</h3>
                <p className="text-muted-foreground mt-1 mb-4">
                  Create your first stream and start sharing music with friends
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {streams.map((stream) => (
                <StreamCard key={stream.id} stream={stream} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}