import express from "express";
import http from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import Redis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL || "redis://127.0.0.1:6379";

const app = express();
const server = http.createServer(app);

const pubClient = new Redis(REDIS_URL);
const subClient = pubClient.duplicate();

const ctrlPub = new Redis(REDIS_URL);
const ctrlSub = new Redis(REDIS_URL);

const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"],
  },
});

io.adapter(createAdapter(pubClient, subClient));


const rooms = new Map();


app.use(express.json());

// Simple REST to list rooms (quick admin)
app.get("/rooms", (req, res) => {
  const list = [];
  for (const [id, room] of rooms.entries()) {
    list.push({
      roomId: id,
      hostId: room.hostId,
      hostSocketId: room.hostSocketId,
      listenersCount: room.listeners.size,
      createdAt: room.createdAt,
    });
  }
  res.json(list);
});

// Publish control messages from some admin HTTP endpoint optionally
app.post("/rooms/:roomId/control", (req, res) => {
  const { roomId } = req.params;
  const payload = req.body; 
  ctrlPub.publish(`room_ctrl:${roomId}`, JSON.stringify(payload));
  res.json({ ok: true });
});

// Socket.IO signaling
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // Host creates a room
  socket.on("create-room", ({ roomId,hostId }, cb) => {
    console.log("create-room", roomId);
    if (!roomId) {
      return cb?.({ error: "roomId required" });
    }
    rooms.set(roomId, {
      roomId,
      hostSocketId: socket.id,
      hostId: hostId,
      createdAt: Date.now(),
      listeners: new Set(),
    });
    socket.join(roomId); // host joins the room channel
    console.log(`Room created: ${roomId} by host ${socket.id}`);
    
    // Add debug listener for new-listener events
    socket.on("new-listener", (data) => {
      console.log(`Host ${socket.id} received new-listener event:`, data);
    });
    
    cb?.({ ok: true, roomId });
  });

  // Listener wants to join a room
  socket.on("join-room", ({ roomId, displayName }, cb) => {
    const room = rooms.get(roomId);
    if (!room) return cb?.({ error: "room-not-found" });

    // Add listener to in-memory list
    room.listeners.add(socket.id);
    socket.join(roomId);
    console.log(`Listener ${socket.id} joined room ${roomId}`);

    // Debug: Check if host socket is still connected
    const hostSocket = io.sockets.sockets.get(room.hostSocketId);
    console.log(`Host socket exists: ${!!hostSocket}, hostSocketId: ${room.hostSocketId}`);
    
    // Notify host that a new listener joined (host should create offer targeted to this socket)
    console.log(`Notifying host ${room.hostSocketId} about new listener ${socket.id}`);
    io.to(room.hostSocketId).emit("new-listener", {
      listenerId: socket.id,
      displayName: displayName || "listener",
    });

    cb?.({ ok: true, listenerId: socket.id });
  });

  socket.on("offer", ({ roomId, targetListenerId, sdp }) => {
    console.log(`Offer from host ${socket.id} for listener ${targetListenerId}`);
    io.to(targetListenerId).emit("offer", { from: socket.id, sdp, roomId });
  });

  socket.on("answer", ({ roomId, targetHostId, sdp }) => {
    console.log(`Answer from listener ${socket.id} to host ${targetHostId}`);
    io.to(targetHostId).emit("answer", { from: socket.id, sdp, roomId });
  });

  socket.on("ice-candidate", ({ targetId, candidate }) => {
    io.to(targetId).emit("ice-candidate", { from: socket.id, candidate });
  });

  // Host or anybody can send control messages via socket; server will publish to Redis channel
  socket.on("control", ({ roomId, payload }) => {

    console.log(`Control publish room ${roomId}:`, payload);
    ctrlPub.publish(`room_ctrl:${roomId}`, JSON.stringify(payload));
  });

  // When a socket disconnects, cleanup
  socket.on("disconnect", (reason) => {
    console.log("socket disconnected:", socket.id, reason);
    // Remove from any rooms
    for (const [roomId, room] of rooms.entries()) {
      if (room.hostSocketId === socket.id) {
        // Host left — notify listeners and remove room
        io.to(roomId).emit("host-left", { roomId });
        rooms.delete(roomId);
        console.log(`Host left. Room ${roomId} closed.`);
      } else if (room.listeners.has(socket.id)) {
        room.listeners.delete(socket.id);
        // notify host that listener left
        io.to(room.hostSocketId).emit("listener-left", { listenerId: socket.id });
        console.log(`Listener ${socket.id} removed from room ${roomId}`);
      }
    }
  });
});

// Redis subscriber listens for control messages and relays them to room members via socket.io
ctrlSub.psubscribe("room_ctrl:*", (err, count) => {
  if (err) console.error("ctrlSub subscribe error", err);
  else console.log("Subscribed to control channels");
});

ctrlSub.on("pmessage", (pattern, channel, message) => {
  // channel like "room_ctrl:ROOMID"
  try {
    const roomId = channel.split(":")[1];
    const payload = JSON.parse(message);
    // Emit to all sockets in the room
    io.to(roomId).emit("control", payload);
    console.log(`Relayed control to room ${roomId}:`, payload);
  } catch (e) {
    console.error("Error parsing control message", e);
  }
});

server.listen(PORT, () => {
  console.log(`Signaling server running on :${PORT}`);
});
