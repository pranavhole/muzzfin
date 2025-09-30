"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipForward } from "lucide-react";
import Image from "next/image";
import axios from "axios";

interface MusicPlayerProps {
  stream: any;
  isPlaying?: boolean;
  currentTime?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onSkip?: () => Promise<any> | any;
  onSeek?: (time: number) => void;
}

export default function MusicPlayer({
  stream,
  isPlaying = false,
  currentTime = 0,
  onPlay,
  onPause,
  onSkip,
  onSeek,
}: MusicPlayerProps) {
  const currentSong = stream?.currentSong || null;
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [id, setId] = useState<string | null>(null);

  const lastSeekEmit = useRef<number>(0);
  const seekTimeout = useRef<NodeJS.Timeout | null>(null);

  // reset when song changes
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setIsLoading(true);
    setIsReady(false);
    setId(null);
    setDuration(0);
  }, [stream]);

  // poll until backend marks song ready
  useEffect(() => {
    if (!currentSong) return;

    let active = true;
    let pollTimeout: NodeJS.Timeout;

    const poll = async () => {
      try {
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/play/ready/${currentSong.id}`
        );
        if (!active) return;

        if (res.data.ready) {
          setIsReady(true);
          setIsLoading(false);
          setId(res.data.id);
        } else {
          pollTimeout = setTimeout(poll, 2000);
        }
      } catch (err) {
        console.error("Polling error:", err);
        if (active) {
          pollTimeout = setTimeout(poll, 4000);
        }
      }
    };

    poll();

    return () => {
      active = false;
      clearTimeout(pollTimeout);
    };
  }, [currentSong]);

  const audioUrl =
    isReady && currentSong
      ? `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/v1/play/${id}/playlist.m3u8`
      : null;

  // setup HLS
  useEffect(() => {
    if (!audioUrl || !audioRef.current) return;

    const audio = audioRef.current;
    let hls: Hls | null = null;

    const handleLoadedMetadata = () => {
      const dur = audio.duration;
      setDuration(isFinite(dur) && dur > 0 ? dur : currentSong?.duration || 0);
    };

    const handleEnded = async () => {
      setTimeout(async () => {
        if (onSkip) await onSkip();
        window.location.reload(); 
      }, 200); 
    };

    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastSeekEmit.current >= 3000) {
        lastSeekEmit.current = now;
        onSeek?.(audio.currentTime);
      }
    };

    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("timeupdate", handleTimeUpdate);

    if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(audioUrl);
      hls.attachMedia(audio);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        if (data.levels?.[0]?.details) {
          setDuration(
            data.levels[0].details.totalduration || currentSong?.duration || 0
          );
        }
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        console.error("[HLS Error]", data);
      });
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = audioUrl;
    }

    return () => {
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      if (hls) hls.destroy();
    };
  }, [audioUrl, currentSong]);

  // sync play/pause
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current
        .play()
        .catch((err) => console.warn("[Autoplay blocked]", err));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // sync seek
  useEffect(() => {
    if (!audioRef.current) return;
    if (Math.abs(audioRef.current.currentTime - currentTime) > 1) {
      audioRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // handle manual slider seek with debounce
  const handleSeek = (value: number[]) => {
    const time = value[0];
    if (audioRef.current) audioRef.current.currentTime = time;

    if (seekTimeout.current) clearTimeout(seekTimeout.current);
    seekTimeout.current = setTimeout(() => {
      onSeek?.(time);
    }, 500);
  };

  const handlePlay = () => {
    if (audioRef.current) audioRef.current.play().catch(console.error);
    onPlay?.();
  };

  if (isLoading) return <div>Loading player...</div>;
  if (!currentSong) return <div>No song selected</div>;

  return (
    <div className="flex items-center gap-4 p-4 border rounded-2xl bg-card shadow-sm">
      {currentSong.thumbnail && (
        <Image
          src={currentSong.thumbnail}
          alt="Thumbnail"
          className="w-16 h-16 rounded-xl object-cover"
          width={64}
          height={64}
          unoptimized
        />
      )}
      <div className="flex-1">
        <h4 className="font-semibold">{currentSong.title}</h4>
        <Slider
          value={[currentTime]}
          max={duration}
          step={1}
          className="mt-2"
          onValueChange={handleSeek}
        />
        <div className="flex items-center gap-2 mt-2">
          <Button
            size="icon"
            variant="outline"
            onClick={isPlaying ? onPause : handlePlay}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button size="icon" variant="outline" onClick={onSkip}>
            <SkipForward />
          </Button>
          <span className="text-xs text-muted-foreground">
            {Math.floor(currentTime)}s / {Math.floor(duration)}s
          </span>
        </div>
      </div>
      <audio ref={audioRef} controls={false} />
    </div>
  );
}
