const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { setupSocketHandlers } = require("./socket");
const { pool } = require("./database");

require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Basic route for health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "QuizSmash Server Running" });
});

// Get active rooms
app.get("/api/rooms", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.id, 
        r.code, 
        r.topic, 
        r.difficulty, 
        r.status,
        r.created_at,
        COUNT(p.id) as player_count
      FROM rooms r
      LEFT JOIN players p ON r.id = p.room_id
      WHERE r.status = 'waiting'
      GROUP BY r.id, r.code, r.topic, r.difficulty, r.status, r.created_at
      ORDER BY r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching rooms:", error);
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
  connectionStateRecovery: {
    maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
    skipMiddlewares: true,
  },
});

// Setup socket handlers
setupSocketHandlers(io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/api/health`);
});
