"use client";

import { useState, useEffect } from "react";
import { Stream } from "@/lib/types";
import { getStreams } from "@/lib/mock-data";
import { StreamCard } from "@/components/StreamCard";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Radio, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import axios from "axios";
import { any } from "zod";

export default function StreamsPage() {
  const [streams, setStreams] = useState<Stream[]>([]);
  const [filteredStreams, setFilteredStreams] = useState<Stream[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchStreams();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredStreams(streams);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = streams.filter(stream => 
        stream.title.toLowerCase().includes(query)
      );
      setFilteredStreams(filtered);
    }
  }, [searchQuery, streams]);

  const fetchStreams = async () => {
    setIsLoading(true);
    try {
      const allStreams = await axios.get("http://localhost:5000/api/v1/streams",{params: {mode:"all"}}).then(res => res.data);
      // Filter to only show active streams
      const activeStreams = allStreams.filter((stream:any) => stream.isActive);
      setStreams(activeStreams);
      setFilteredStreams(activeStreams);
    } catch (error) {
      console.error("Error fetching streams:", error);
      toast({
        title: "Error",
        description: "Failed to load streams",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container py-10">
      <div className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Live Streams</h1>
          <p className="text-muted-foreground">
            Join a music stream and listen together with others
          </p>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search streams..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Streams list */}
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filteredStreams.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center text-center py-12">
              <Radio className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No streams found</h3>
              <p className="text-muted-foreground mt-1">
                {searchQuery ? 
                  "No streams match your search query" : 
                  "There are no active streams at the moment"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredStreams.map((stream) => (
              <StreamCard key={stream.id} stream={stream} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}