import Link from "next/link";
import { Stream } from "@/lib/types";
import { Users, Radio } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StreamCardProps {
  stream: Stream;
  className?: string;
}

export function StreamCard({ stream, className }: StreamCardProps) {
  return (
    <Link 
      href={`/stream/${stream.id}`}
      className={cn(
        "block border rounded-lg overflow-hidden bg-card transition-all hover:shadow-md",
        className
      )}
    >
      <div className="aspect-video bg-muted relative">
        <div className="absolute inset-0 flex items-center justify-center">
          <Radio className="h-12 w-12 text-primary/50" />
        </div>
        {stream.isActive && (
          <Badge variant="secondary" className="absolute top-2 right-2 bg-green-500/20 text-green-500 border-green-500/50">
            Live
          </Badge>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-medium truncate">{stream.title}</h3>
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center text-muted-foreground text-xs">
            <Users className="h-3 w-3 mr-1" />
            <span>{stream.listeners} listening</span>
          </div>
          <div className="text-xs text-muted-foreground">
            Started {formatDistanceToNow(new Date(stream.createdAt), { addSuffix: true })}
          </div>
        </div>
      </div>
    </Link>
  );
}