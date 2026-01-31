const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

// CORS setup
app.use(
  cors({
    origin: "*", // Allow all for now, we'll restrict later
    methods: ["GET", "POST"],
    credentials: true,
  }),
);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "QuizSmash Backend Running",
    timestamp: new Date().toISOString(),
  });
});

// Socket.io setup with minimal config
const io = new Server(server, {
  cors: {
    origin: "*", // Allow all origins for debugging
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["polling", "websocket"], // Start with polling, then upgrade
  allowEIO3: true, // For older clients
  pingTimeout: 60000,
  pingInterval: 25000,
  cookie: false,
});

// Basic socket connection
io.on("connection", (socket) => {
  console.log("✅ Client connected:", socket.id);

  // Create room
  socket.on("create-room", (username, callback) => {
    console.log("Create room request from:", username);
    const roomCode = "ABC123"; // Temporary for testing
    callback({
      success: true,
      roomCode,
      playerId: socket.id,
      isHost: true,
      players: [
        { id: socket.id, username, score: 0, isReady: false, isHost: true },
      ],
    });
  });

  // Join room
  socket.on("join-room", ({ roomCode, username }, callback) => {
    console.log(`Join room request: ${username} to ${roomCode}`);
    callback({
      success: true,
      roomCode,
      playerId: socket.id,
      isHost: false,
      players: [
        {
          id: "host123",
          username: "Host",
          score: 0,
          isReady: false,
          isHost: true,
        },
        { id: socket.id, username, score: 0, isReady: false, isHost: false },
      ],
    });
  });

  // Get active rooms
  socket.on("get-active-rooms", (callback) => {
    console.log("Active rooms request");
    callback({
      success: true,
      rooms: [
        {
          code: "ABC123",
          host_username: "TestHost",
          topic: "Space Exploration",
          difficulty: "medium",
          status: "waiting",
          current_players: 2,
          max_players: 4,
          created_at: new Date().toISOString(),
          player_names: ["TestHost", "Player1"],
        },
      ],
    });
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected:", socket.id);
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });
});

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`
🚀 QuizSmash Backend Server
─────────────────────────────
✅ REST API: http://localhost:${PORT}/api/health
🔌 Socket.IO: ws://localhost:${PORT}
📡 Transport: polling + websocket
─────────────────────────────
  `);
});

// Handle shutdown
process.on("SIGTERM", () => {
  console.log("Shutting down server...");
  server.close();
  process.exit(0);
});
