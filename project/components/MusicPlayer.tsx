"use client";

import { useEffect, useRef, useState, RefObject } from "react";
import Hls from "hls.js";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Play, Pause, SkipForward, Music2, Loader2 } from "lucide-react";
import Image from "next/image";
import axios from "axios";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

interface MusicPlayerProps {
  stream: any;
  audioRef: RefObject<HTMLAudioElement>;
  isPlaying?: boolean;
  currentTime?: number;
  onPlay?: () => void;
  onPause?: () => void;
  onSkip?: () => Promise<any> | any;
  onSeek?: (time: number) => void;
  host?: boolean;
}

type SongStatus = "checking" | "downloading" | "ready" | "none";

function formatTime(secs: number) {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export default function MusicPlayer({
  stream,
  audioRef,
  isPlaying = false,
  currentTime = 0,
  onPlay,
  onPause,
  onSkip,
  onSeek,
  host,
}: MusicPlayerProps) {
  const currentSong = stream?.currentSong ?? null;

  const [status, setStatus] = useState<SongStatus>("none");
  const [hlsId, setHlsId] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [localTime, setLocalTime] = useState(0);

  const hlsRef = useRef<Hls | null>(null);
  const seekTimeout = useRef<NodeJS.Timeout | null>(null);
  const lastEmit = useRef(0);
  const songIdRef = useRef<string | null>(null);
  const downloadPercent = (currentSong as any)?.progressPercent;
  const downloadStage = (currentSong as any)?.progressStage;

  // ── Reset when song changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentSong) {
      setStatus("none");
      setHlsId(null);
      setDuration(0);
      setLocalTime(0);
      return;
    }
    if (songIdRef.current === currentSong.id) return; // same song, no reset
    songIdRef.current = currentSong.id;

    // tear down existing HLS
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
    }
    setStatus("checking");
    setHlsId(null);
    setDuration(0);
    setLocalTime(0);
  }, [currentSong?.id]);

  // ── Poll until ready ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentSong || status === "ready") return;

    let active = true;
    let timer: NodeJS.Timeout;

    const poll = async () => {
      try {
        const res = await axios.get(
          `${BACKEND}/api/v1/play/ready/${currentSong.id}`
        );
        if (!active) return;

        if (res.data.ready) {
          setHlsId(res.data.id);
          setStatus("ready");
        } else {
          setStatus("downloading");
          timer = setTimeout(poll, 2500);
        }
      } catch {
        if (active) timer = setTimeout(poll, 4000);
      }
    };

    poll();
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [currentSong?.id, status]);

  // ── Mount HLS once ready ─────────────────────────────────────────────────
  useEffect(() => {
    if (status !== "ready" || !hlsId || !audioRef.current) return;

    const audio = audioRef.current;
    const url = `${BACKEND}/api/v1/play/${hlsId}/playlist.m3u8`;

    const onMeta = () => {
      const d = audio.duration;
      setDuration(isFinite(d) && d > 0 ? d : currentSong?.duration ?? 0);
    };
    const onTimeUpdate = () => {
      setLocalTime(audio.currentTime);
      const now = Date.now();
      if (now - lastEmit.current >= 3000) {
        lastEmit.current = now;
        onSeek?.(audio.currentTime);
      }
    };
    const onEnded = () => onSkip?.();

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    if (Hls.isSupported()) {
      const hls = new Hls({ enableWorker: false });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (isPlaying) audio.play().catch(() => {});
      });
      hls.on(Hls.Events.LEVEL_LOADED, (_, data) => {
        const d = data.details.totalduration;
        if (d > 0) setDuration(d);
      });
      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) console.error("[HLS fatal]", data);
      });
    } else if (audio.canPlayType("application/vnd.apple.mpegurl")) {
      audio.src = url;
      if (isPlaying) audio.play().catch(() => {});
    }

    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [status, hlsId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync play / pause from server ───────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || status !== "ready") return;
    if (isPlaying) audio.play().catch(() => {});
    else audio.pause();
  }, [isPlaying, status]);

  // ── Sync seek from server ────────────────────────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || status !== "ready") return;
    if (Math.abs(audio.currentTime - currentTime) > 2) {
      audio.currentTime = currentTime;
    }
  }, [currentTime, status]);

  // ── Slider interaction ───────────────────────────────────────────────────
  const handleSlider = (value: number[]) => {
    if (!host) return; // viewers cannot seek
    const t = value[0];
    setLocalTime(t);
    if (audioRef.current) audioRef.current.currentTime = t;
    if (seekTimeout.current) clearTimeout(seekTimeout.current);
    seekTimeout.current = setTimeout(() => onSeek?.(t), 400);
  };

  const handlePlayPause = () => {
    if (!host) return;
    if (isPlaying) onPause?.();
    else {
      audioRef.current?.play().catch(() => {});
      onPlay?.();
    }
  };

  // ── UI states ────────────────────────────────────────────────────────────
  if (status === "none") {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-muted-foreground">
        <Music2 className="w-10 h-10 opacity-40" />
        <p className="text-sm">No song playing</p>
      </div>
    );
  }

  if (status === "checking" || status === "downloading") {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-4">
        <div className="relative w-16 h-16">
          {currentSong?.thumbnail ? (
            <Image
              src={currentSong.thumbnail}
              alt={currentSong.title}
              fill
              className="rounded-xl object-cover opacity-60"
              unoptimized
            />
          ) : (
            <div className="w-16 h-16 rounded-xl bg-primary/10 flex items-center justify-center">
              <Music2 className="w-7 h-7 text-primary/40" />
            </div>
          )}
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        </div>
        <div className="text-center">
          <p className="font-medium text-sm truncate max-w-[260px]">{currentSong?.title}</p>
          <p className="text-xs text-muted-foreground mt-1 animate-pulse">
            {status === "checking" ? "Checking availability…" : "Downloading & processing…"}
          </p>
        </div>
        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary/60 rounded-full transition-all"
            style={{ width: `${Math.min(downloadPercent ?? 30, 95)}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground">
          {downloadStage ?? status} • {downloadPercent ?? 30}%
        </span>
      </div>
    );
  }

  // ready
  return (
    <div className="flex flex-col gap-4">
      {/* Song info row */}
      <div className="flex items-center gap-4">
        <div className="relative w-14 h-14 flex-shrink-0">
          {currentSong?.thumbnail ? (
            <Image
              src={currentSong.thumbnail}
              alt={currentSong.title}
              fill
              className="rounded-xl object-cover"
              unoptimized
            />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
              <Music2 className="w-6 h-6 text-primary/50" />
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold truncate">{currentSong?.title}</p>
          <p className="text-sm text-muted-foreground truncate">{currentSong?.artist}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1">
        <Slider
          value={[localTime]}
          max={duration || 1}
          step={0.5}
          onValueChange={handleSlider}
          className="w-full"
          disabled={!host}
        />
        <div className="flex justify-between text-xs text-muted-foreground px-0.5">
          <span>{formatTime(localTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3">
        <Button
          size="icon"
          variant={isPlaying ? "default" : "outline"}
          className="h-11 w-11 rounded-full"
          onClick={handlePlayPause}
          disabled={!host}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </Button>
        {host && (
          <Button
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-full"
            onClick={onSkip}
            disabled={!host}
          >
            <SkipForward className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Hidden audio — controlled via ref */}
      <audio ref={audioRef} hidden />
    </div>
  );
}
