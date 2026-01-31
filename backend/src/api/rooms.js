const express = require("express");
const router = express.Router();
const db = require("../database");

// Get all active rooms (public rooms list)
router.get("/active", async (req, res) => {
  try {
    const rooms = await db.getActiveRooms();
    res.json({
      success: true,
      data: rooms,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error fetching active rooms:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch active rooms",
    });
  }
});

// Get room details by code
router.get("/:code", async (req, res) => {
  try {
    const room = await db.getRoomByCode(req.params.code);

    if (!room) {
      return res.status(404).json({
        success: false,
        error: "Room not found",
      });
    }

    res.json({
      success: true,
      data: room,
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch room details",
    });
  }
});

// Validate room code (check if room exists and can be joined)
router.post("/validate", async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({
        success: false,
        error: "Invalid room code format",
      });
    }

    const room = await db.getRoomByCode(code.toUpperCase());

    if (!room) {
      return res.json({
        success: false,
        error: "Room not found",
      });
    }

    if (room.status !== "waiting") {
      return res.json({
        success: false,
        error: "Game has already started",
      });
    }

    if (room.current_players >= room.max_players) {
      return res.json({
        success: false,
        error: "Room is full",
      });
    }

    res.json({
      success: true,
      data: {
        code: room.code,
        host: room.host_username,
        topic: room.topic,
        currentPlayers: room.current_players,
        maxPlayers: room.max_players,
        status: room.status,
      },
    });
  } catch (error) {
    console.error("Error validating room:", error);
    res.status(500).json({
      success: false,
      error: "Failed to validate room",
    });
  }
});

module.exports = router;
