"use client";

import { Song } from "@/lib/types";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ChevronUp, Music, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

interface SongQueueProps {
  songs: Song[];
  onVote: (songId: string) => void;
  onRemove?: (songId: string) => void;
  className?: string;
}

export function SongQueue({ songs, onVote, onRemove, className }: SongQueueProps) {
  const { user } = useAuth();
  
  if (songs.length === 0) {
    return (
      <div className={cn("p-4 border rounded-lg bg-card", className)}>
        <div className="py-10 flex flex-col items-center justify-center text-center">
          <Music className="h-12 w-12 text-muted-foreground mb-2" />
          <h3 className="text-lg font-medium">Queue is empty</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Be the first to add a song to the queue!
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className={cn("border rounded-lg bg-card overflow-hidden", className)}>
      <div className="p-3 border-b bg-muted/30">
        <h3 className="text-sm font-medium">Up next ({songs.length})</h3>
      </div>
      <ul className="divide-y max-h-[500px] overflow-y-auto">
        {songs.map((song) => (
          <li key={song.id} className="p-3 hover:bg-muted/40 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center justify-center w-10">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => onVote(song.id)}
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
                <span className="text-xs font-medium">{song.votes}</span>
              </div>
              
              <div className="w-10 h-10 rounded-md overflow-hidden bg-secondary flex-shrink-0">
                {song.thumbnail ? (
                  <img 
                    src={song.thumbnail} 
                    alt={song.title} 
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-primary/10">
                    <span className="text-lg font-bold text-primary/50">
                      {song.title.charAt(0)}
                    </span>
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{song.title}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {song.artist} • {formatDistanceToNow(new Date(song.addedAt), { addSuffix: true })}
                </p>
              </div>
              
              {onRemove && user && user.id === song.addedBy && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(song.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}