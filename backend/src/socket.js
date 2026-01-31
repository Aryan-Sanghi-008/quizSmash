const db = require("./database");

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);

    // Create a new room
    socket.on("create-room", async (username, callback) => {
      try {
        if (!username || username.trim().length < 2) {
          throw new Error("Username must be at least 2 characters");
        }

        const roomCode = generateRoomCode();
        const { room, player } = await db.createRoom(
          roomCode,
          socket.id,
          username.trim(),
        );

        socket.join(room.code);

        // Store user info in socket
        socket.userData = {
          playerId: player.id,
          username: player.username,
          roomCode: room.code,
          isHost: player.is_host,
        };

        // Send success response
        callback({
          success: true,
          roomCode: room.code,
          playerId: player.id,
          isHost: true,
          players: [player],
        });

        console.log(`✅ Room created: ${room.code} by ${username}`);
      } catch (error) {
        console.error("Room creation error:", error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });

    // Join existing room
    socket.on("join-room", async ({ roomCode, username }, callback) => {
      try {
        if (!username || username.trim().length < 2) {
          throw new Error("Username must be at least 2 characters");
        }

        if (!roomCode || roomCode.length !== 6) {
          throw new Error("Invalid room code");
        }

        const result = await db.joinRoom(
          roomCode.toUpperCase(),
          username.trim(),
          socket.id,
        );

        socket.join(result.room.code);

        // Store user info in socket
        socket.userData = {
          playerId: result.player.id,
          username: result.player.username,
          roomCode: result.room.code,
          isHost: result.player.is_host,
        };

        // Notify the joiner
        callback({
          success: true,
          roomCode: result.room.code,
          playerId: result.player.id,
          isHost: result.player.is_host,
          players: result.players,
        });

        // Notify others in the room
        socket.to(result.room.code).emit("player-joined", {
          username: result.player.username,
          players: result.players,
          room: {
            code: result.room.code,
            currentPlayers: result.room.current_players,
            maxPlayers: result.room.max_players,
          },
        });

        console.log(`✅ ${username} joined room: ${roomCode}`);
      } catch (error) {
        console.error("Join room error:", error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });

    // Leave room
    socket.on("leave-room", async () => {
      try {
        if (socket.userData) {
          const { roomCode, username } = socket.userData;
          socket.leave(roomCode);

          // Notify others
          socket.to(roomCode).emit("player-left", {
            username,
            message: `${username} left the room`,
          });

          console.log(`👋 ${username} left room: ${roomCode}`);
        }
      } catch (error) {
        console.error("Leave room error:", error);
      }
    });

    // Get active rooms
    socket.on("get-active-rooms", async (callback) => {
      try {
        const rooms = await db.getActiveRooms();
        callback({
          success: true,
          rooms,
        });
      } catch (error) {
        console.error("Get active rooms error:", error);
        callback({
          success: false,
          error: error.message,
        });
      }
    });

    // Player ready status
    socket.on("player-ready", async ({ isReady }) => {
      try {
        if (socket.userData) {
          const { roomCode, playerId } = socket.userData;

          // Update player ready status in DB
          // (You'll need to add this method to your database.js)

          socket.to(roomCode).emit("player-ready-update", {
            playerId,
            isReady,
          });
        }
      } catch (error) {
        console.error("Player ready error:", error);
      }
    });

    // Handle disconnection
    socket.on("disconnect", async () => {
      console.log(`🔌 Disconnected: ${socket.id}`);

      try {
        if (socket.userData) {
          const { roomCode, username } = socket.userData;

          // Notify others in the room
          socket.to(roomCode).emit("player-disconnected", {
            username,
            message: `${username} disconnected`,
          });
        }
      } catch (error) {
        console.error("Disconnect cleanup error:", error);
      }
    });
  });

  // Cleanup inactive rooms every hour
  setInterval(
    () => {
      db.cleanupInactiveRooms();
    },
    60 * 60 * 1000,
  );
}

module.exports = { setupSocketHandlers };
