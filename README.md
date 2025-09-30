🎵 Muzzy – Collaborative Music Streaming Platform

Muzzy is a modern, cloud-native collaborative music streaming platform where users can submit YouTube URLs, stream audio, and control playback in real-time with other participants. The platform emphasizes scalability, reliability, and seamless real-time collaboration.

🚀 Features

Collaborative Playback Queue 🎵
Users can add tracks, reorder, vote on songs, and control playback collaboratively.

Real-time Sync 🔄
Playback, voting, and control events are synchronized across all connected clients using WebSocket (Socket.IO).

HLS Audio Streaming
Audio is transcoded to HLS (.m3u8 + .ts) and streamed with low latency using HLS.js.

Authentication 🔑
Google OAuth 2.0 login with JWT-based API authentication.

Scalable Backend ⚙️
Node.js/Express API with Redis-based job queues (BullMQ) for processing audio.

Cloud Storage & CDN 🌍☁️
HLS segments are stored in Cloudflare R2 and delivered globally via CDN for optimal streaming performance.

Database & Caching 📦⚡
Postgres stores user, playlist, queue, and track metadata. Redis handles hot playlists and ephemeral sync state.

CI/CD Pipeline 🐙✅🚀
GitHub Actions handle build, test, lint, containerization, and deployments to Vercel/Netlify or Kubernetes clusters.

Observability 📈📜🧭
Metrics, logging, and tracing with SLO-based alerts ensure reliability and quick debugging.

🏗 Architecture Overview



High-level Flow

Client 🎧 → (OAuth) 🔑 → JWT → API → (enqueue) Redis Queue ⚡ → Worker ⚙️ → ytdl/FFmpeg → R2 ☁️ → CDN 🌍 → Client (HLS.js)
Client ↔ Socket.IO 🔄 (sync/controls)
API/Worker ↔ Postgres 📦 and Redis ⚡
GitHub 🐙 → GitHub Actions → (build/test/scan) ✅ → GHCR → Deploy 🚀 → CDN Invalidation

🛠 Tech Stack

Layer	Technology

Frontend	Next.js, React, HLS.js
Authentication	Google OAuth 2.0, JWT, JWKS
Backend API	Node.js, Express, JWT validation
Processing	Redis Queue (BullMQ), Workers, ytdl, FFmpeg
Storage	Cloudflare R2 (HLS segments)
CDN	Cloudflare / Global Edge CDN
Database	Postgres (user, playlist, queue, track metadata)
Caching	Redis (hot playlists, sync state)
Real-time Sync	Socket.IO
CI/CD	GitHub Actions, Docker, GHCR, Terraform/IaC, Vercel/Netlify/K8s
Observability	Prometheus, ELK/OpenSearch, OpenTelemetry


⚙️ Key Components

Client 🎧: Submits YouTube URLs, streams audio via HLS.js, interacts with collaborative queue.

Auth 🔑: Google OAuth 2.0, JWT issuance and validation, JWKS endpoint.

API Layer: Node.js/Express, handles playlist and playback endpoints, JWT validation.

Worker ⚙️: Downloads audio, transcodes HLS segments, uploads to R2 bucket.

Redis Queue ⚡: Distributes jobs and maintains hot cache state.

Postgres 📦: Stores persistent data (users, playlists, rooms, track metadata).

Socket.IO 🔄: Synchronizes playback and votes across users in real-time.

CDN 🌍: Delivers HLS streams globally with low-latency caching.


🔐 Security & Reliability

JWT validation with RS256, JWKS rotation.

Signed URLs for HLS segments.

Retry policies for audio download/transcoding.

Dead-letter queue for failed jobs.

Horizontal scaling for API and worker pods.

Rate limits, idempotency keys, and CORS policies enforce 


📦 Getting Started

Prerequisites

Node.js >= 18

Docker & Docker Compose

PostgreSQL

Redis

Cloudflare R2 account (optional for HLS storage)


Run Locally

# Clone repo
git clone https://github.com/yourusername/muzzy.git
cd muzzy

# Install dependencies
npm install

# Run frontend
npm run dev:frontend

# Run backend API
npm run dev:api

# Run worker
npm run dev:worker

Docker

docker-compose up --build


📌 Notes

Designed for scalability, reliability, and real-time collaboration.

HLS segments served globally with signed URLs for secure access.

Collaborative queue ensures fair voting and playback synchronization.



🔗 Links

Live Demo: https://muzzy.pranavhole.space
