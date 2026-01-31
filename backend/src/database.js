const { Pool } = require("pg");
require("dotenv").config();

class Database {
  constructor() {
    this.pool = new Pool({
      user: process.env.DB_USER || "quizuser",
      host: process.env.DB_HOST || "localhost",
      database: process.env.DB_NAME || "quizsmash",
      password: process.env.DB_PASSWORD || "quizpass",
      port: process.env.DB_PORT || 5432,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.initializeTables();
  }

  async initializeTables() {
    try {
      await this.pool.query(`
        -- Enable UUID extension
        CREATE EXTENSION IF NOT EXISTS "pgcrypto";

        -- Rooms table
        CREATE TABLE IF NOT EXISTS rooms (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code VARCHAR(6) UNIQUE NOT NULL,
          host_socket_id VARCHAR(100),
          host_username VARCHAR(50) NOT NULL,
          topic VARCHAR(100),
          difficulty VARCHAR(20) DEFAULT 'medium',
          status VARCHAR(20) DEFAULT 'waiting',
          max_players INTEGER DEFAULT 4,
          current_players INTEGER DEFAULT 1,
          current_question INTEGER DEFAULT 0,
          total_questions INTEGER DEFAULT 3,
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
          settings JSONB DEFAULT '{"timePerQuestion": 20, "pointsPerQuestion": 10}'
        );

        -- Players table
        CREATE TABLE IF NOT EXISTS players (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
          username VARCHAR(50) NOT NULL,
          socket_id VARCHAR(100) NOT NULL,
          score INTEGER DEFAULT 0,
          is_ready BOOLEAN DEFAULT false,
          is_host BOOLEAN DEFAULT false,
          joined_at TIMESTAMP DEFAULT NOW(),
          last_active TIMESTAMP DEFAULT NOW(),
          UNIQUE(room_id, username)
        );

        -- Create indexes for performance
        CREATE INDEX IF NOT EXISTS idx_rooms_code ON rooms(code);
        CREATE INDEX IF NOT EXISTS idx_rooms_status ON rooms(status);
        CREATE INDEX IF NOT EXISTS idx_players_room_id ON players(room_id);
        CREATE INDEX IF NOT EXISTS idx_players_socket_id ON players(socket_id);
      `);
      console.log("✅ Database tables initialized successfully");
    } catch (error) {
      console.error("❌ Database initialization error:", error);
    }
  }

  // Room operations
  async createRoom(code, hostSocketId, hostUsername) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      const roomQuery = `
        INSERT INTO rooms (code, host_socket_id, host_username, current_players)
        VALUES ($1, $2, $3, 1)
        RETURNING *
      `;
      const roomResult = await client.query(roomQuery, [
        code,
        hostSocketId,
        hostUsername,
      ]);

      const playerQuery = `
        INSERT INTO players (room_id, username, socket_id, is_host)
        VALUES ($1, $2, $3, true)
        RETURNING id, username, score, is_ready, is_host
      `;
      const playerResult = await client.query(playerQuery, [
        roomResult.rows[0].id,
        hostUsername,
        hostSocketId,
      ]);

      await client.query("COMMIT");

      return {
        room: roomResult.rows[0],
        player: playerResult.rows[0],
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getRoomByCode(code) {
    const result = await this.pool.query(
      `SELECT r.*, 
              json_agg(
                json_build_object(
                  'id', p.id,
                  'username', p.username,
                  'score', p.score,
                  'is_ready', p.is_ready,
                  'is_host', p.is_host
                )
              ) as players
       FROM rooms r
       LEFT JOIN players p ON r.id = p.room_id
       WHERE r.code = $1
       GROUP BY r.id`,
      [code],
    );
    return result.rows[0];
  }

  async joinRoom(roomCode, username, socketId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");

      // Get room
      const roomResult = await client.query(
        "SELECT * FROM rooms WHERE code = $1 AND status = $2",
        [roomCode, "waiting"],
      );

      if (roomResult.rows.length === 0) {
        throw new Error("Room not found or game already started");
      }

      const room = roomResult.rows[0];

      // Check room capacity
      if (room.current_players >= room.max_players) {
        throw new Error("Room is full");
      }

      // Check if username exists in room
      const existingPlayer = await client.query(
        "SELECT username FROM players WHERE room_id = $1 AND username = $2",
        [room.id, username],
      );

      if (existingPlayer.rows.length > 0) {
        throw new Error("Username already taken in this room");
      }

      // Add player
      const playerResult = await client.query(
        `INSERT INTO players (room_id, username, socket_id, is_host)
         VALUES ($1, $2, $3, false)
         RETURNING id, username, score, is_ready, is_host`,
        [room.id, username, socketId],
      );

      // Update room player count
      await client.query(
        "UPDATE rooms SET current_players = current_players + 1 WHERE id = $1",
        [room.id],
      );

      // Get updated player list
      const playersResult = await client.query(
        `SELECT id, username, score, is_ready, is_host 
         FROM players 
         WHERE room_id = $1 
         ORDER BY joined_at`,
        [room.id],
      );

      await client.query("COMMIT");

      return {
        room: {
          ...room,
          current_players: room.current_players + 1,
        },
        player: playerResult.rows[0],
        players: playersResult.rows,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async getActiveRooms() {
    const result = await this.pool.query(`
      SELECT 
        r.code,
        r.host_username,
        r.topic,
        r.difficulty,
        r.status,
        r.current_players,
        r.max_players,
        r.created_at,
        COUNT(p.id) as player_count,
        array_agg(p.username) as player_names
      FROM rooms r
      LEFT JOIN players p ON r.id = p.room_id
      WHERE r.status = 'waiting' 
        AND r.expires_at > NOW()
      GROUP BY r.id, r.code, r.host_username, r.topic, r.difficulty, 
               r.status, r.current_players, r.max_players, r.created_at
      ORDER BY r.created_at DESC
      LIMIT 50
    `);
    return result.rows;
  }

  async updatePlayerSocket(playerId, socketId) {
    await this.pool.query(
      "UPDATE players SET socket_id = $1, last_active = NOW() WHERE id = $2",
      [socketId, playerId],
    );
  }

  async cleanupInactiveRooms() {
    // Remove rooms older than 24 hours
    await this.pool.query(
      "DELETE FROM rooms WHERE expires_at < NOW() OR status = 'completed'",
    );
    console.log("🧹 Cleaned up inactive rooms");
  }
}

module.exports = new Database();
