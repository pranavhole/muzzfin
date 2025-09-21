"use client";

import { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

interface AudioStreamProps {
  streamId: string;
  isHost: boolean;
  youtubeUrl?: string; // host provides this
}

const socket = io("http://localhost:5001");

 const AudioStream = ({
  streamId,
  isHost,
  youtubeUrl,
}: AudioStreamProps) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [pc, setPc] = useState<RTCPeerConnection | null>(null);

  // --- HOST sends command to backend to start pipeline ---
  useEffect(() => {
    if (isHost && youtubeUrl) {
      socket.emit("create-stream", { streamId, url: youtubeUrl });
      console.log("🎵 Host requested stream creation", youtubeUrl);
    }
  }, [isHost, streamId, youtubeUrl]);

  // --- LISTENER joins and negotiates WebRTC ---
  useEffect(() => {
    if (!isHost) {
      socket.emit("join-stream", { streamId });

      socket.on("stream-started", async ({ url }) => {
        console.log("📡 Stream started from:", url);

        const pc = new RTCPeerConnection({
          iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
        });
        setPc(pc);

        // Play incoming audio
        pc.ontrack = (event) => {
          console.log("🎧 Received remote audio");
          if (audioRef.current) {
            audioRef.current.srcObject = event.streams[0];
            audioRef.current
              .play()
              .catch(() => console.warn("Autoplay blocked, use play button"));
          }
        };

        pc.onicecandidate = (ev) => {
          if (ev.candidate) {
            socket.emit("webrtc-ice", { streamId, candidate: ev.candidate });
          }
        };

        // 1. Create offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // 2. Send offer
        socket.emit("webrtc-offer", { streamId, sdp: offer.sdp });

        // 3. Receive answer
        socket.on("webrtc-answer", async ({ sdp }) => {
          await pc.setRemoteDescription({ type: "answer", sdp });
        });

        // 4. ICE from server
        socket.on("webrtc-ice", async ({ candidate }) => {
          if (candidate) {
            try {
              await pc.addIceCandidate(candidate);
            } catch (err) {
              console.error("ICE error:", err);
            }
          }
        });
      });
    }
  }, [isHost, streamId]);

  return (
      <div className="p-4 rounded shadow-md">
        { isHost ? (
          <div>
            <h2 className="text-xl font-bold">🎙 Host Mode</h2>
            <p>Streaming from: {youtubeUrl}</p>
          </div>
        ) : (
          <div>
            <h2 className="text-xl font-bold">🎧 Listener Mode</h2>
            <audio ref={audioRef} controls autoPlay />
            <button
              onClick={() => audioRef.current?.play()}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
            >
              ▶️ Play
            </button>
          </div>
        )}
      </div>
  );
}

export default AudioStream;