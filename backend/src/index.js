const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const { Pool } = require("pg");
const { OpenAI } = require("openai");
const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || "quizuser",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "quizsmash",
  password: process.env.DB_PASSWORD || "quizpass",
  port: process.env.DB_PORT || 5432,
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.stack);
  } else {
    console.log("✅ Connected to PostgreSQL database");
    release();
  }
});

// CORS setup
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
  }),
);
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "QuizSmash Backend Running",
    timestamp: new Date().toISOString(),
    database: "connected",
    openai: process.env.OPENAI_API_KEY ? "configured" : "not configured",
  });
});

// Get active rooms (public API)
app.get("/api/rooms/active", async (req, res) => {
  try {
    const result = await pool.query(`
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
      WHERE r.status IN ('waiting', 'active') 
        AND r.expires_at > NOW()
      GROUP BY r.id, r.code, r.host_username, r.topic, r.difficulty, 
               r.status, r.current_players, r.max_players, r.created_at
      ORDER BY r.created_at DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      rooms: result.rows,
    });
  } catch (error) {
    console.error("Error fetching active rooms:", error);
    res.status(500).json({ success: false, error: "Failed to fetch rooms" });
  }
});

// Get room by code
app.get("/api/rooms/:code", async (req, res) => {
  try {
    const { code } = req.params;

    const result = await pool.query(
      `
      SELECT 
        r.*,
        json_agg(
          json_build_object(
            'id', p.id,
            'username', p.username,
            'score', p.score,
            'is_host', p.is_host,
            'has_answered', p.has_answered,
            'current_answer', p.current_answer
          )
        ) as players
      FROM rooms r
      LEFT JOIN players p ON r.id = p.room_id
      WHERE r.code = $1
      GROUP BY r.id
    `,
      [code.toUpperCase()],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Room not found" });
    }

    res.json({
      success: true,
      room: result.rows[0],
    });
  } catch (error) {
    console.error("Error fetching room:", error);
    res.status(500).json({ success: false, error: "Failed to fetch room" });
  }
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["polling", "websocket"],
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Helper function to generate unique room code
function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Helper function to check if username is valid
function isValidUsername(username) {
  return (
    username && username.trim().length >= 2 && username.trim().length <= 20
  );
}

async function cleanupEmptyOrHostlessRooms() {
  try {
    console.log("🧹 Checking for empty or hostless rooms...");

    // Find rooms that have no active players OR have no active host
    const result = await pool.query(`
      WITH room_stats AS (
        SELECT 
          r.id,
          r.code,
          r.status,
          COUNT(CASE WHEN p.socket_id IS NOT NULL THEN 1 END) as active_players,
          COUNT(CASE WHEN p.is_host = true AND p.socket_id IS NOT NULL THEN 1 END) as active_hosts
        FROM rooms r
        LEFT JOIN players p ON r.id = p.room_id
        WHERE r.status IN ('waiting', 'active')
          AND r.expires_at > NOW()
        GROUP BY r.id, r.code, r.status
      )
      DELETE FROM rooms 
      WHERE id IN (
        SELECT id FROM room_stats 
        WHERE active_players = 0 OR active_hosts = 0
      )
      RETURNING code, status
    `);

    if (result.rows.length > 0) {
      console.log(
        `🗑️ Cleaned up ${result.rows.length} empty/hostless rooms:`,
        result.rows.map((r) => `${r.code} (${r.status})`).join(", "),
      );

      // Clean up game states and connections for deleted rooms
      result.rows.forEach((row) => {
        gameStates.delete(row.code);
        roomConnections.delete(row.code);
      });
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}

// Cleanup old rooms periodically (existing function - keep this too)
setInterval(async () => {
  try {
    // Delete rooms older than 24 hours
    const result = await pool.query(
      "DELETE FROM rooms WHERE expires_at < NOW() - INTERVAL '24 hours' RETURNING code",
    );

    if (result.rows.length > 0) {
      console.log(`🧹 Cleaned up ${result.rows.length} old expired rooms`);

      // Clean up game states and connections for deleted rooms
      result.rows.forEach((row) => {
        gameStates.delete(row.code);
        roomConnections.delete(row.code);
      });
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}, 3600000); // Run every hour

// Game state management
const gameStates = new Map();

// Store room socket connections
const roomConnections = new Map();

// Improved mock questions function for better fallback
function generateMockQuestions(topic, difficulty, count = 3) {
  console.log(
    `🎭 Generating ${count} mock questions for "${topic}" (${difficulty})`,
  );

  const questions = [];
  const difficultyLevels = {
    easy: {
      prefixes: ["Basic", "Simple", "Fundamental", "Essential"],
      optionTypes: [
        "Correct answer",
        "Common misconception",
        "Unrelated fact",
        "Partial truth",
      ],
    },
    medium: {
      prefixes: ["Intermediate", "Detailed", "Common", "Important"],
      optionTypes: [
        "Key aspect",
        "Secondary fact",
        "Related concept",
        "Expert opinion",
      ],
    },
    hard: {
      prefixes: ["Expert", "Advanced", "Complex", "Challenging"],
      optionTypes: [
        "Nuanced detail",
        "Advanced principle",
        "Counterintuitive fact",
        "Specialized knowledge",
      ],
    },
  };

  const level = difficultyLevels[difficulty] || difficultyLevels.medium;

  for (let i = 1; i <= count; i++) {
    const prefix =
      level.prefixes[Math.floor(Math.random() * level.prefixes.length)];

    const options = level.optionTypes.map((type, index) => {
      if (index === 0) {
        return `Correct: ${type} about ${topic}`;
      }
      return `${type} about ${topic}`;
    });

    // Shuffle options but remember correct answer position
    const correctIndex = Math.floor(Math.random() * 4);
    [options[0], options[correctIndex]] = [options[correctIndex], options[0]];

    questions.push({
      question: `${prefix} question about ${topic}: What should you know?`,
      options: options,
      correctIndex: correctIndex,
    });
  }

  console.log(`✅ Generated ${questions.length} mock questions`);
  return questions;
}

// Generate questions using OpenAI
async function generateQuestionsWithOpenAI(topic, difficulty, count = 3) {
  try {
    console.log(
      `🤖 OpenAI: Generating ${count} questions for "${topic}" (${difficulty})`,
    );

    const prompt = `Generate exactly ${count} multiple-choice quiz questions about "${topic}".
Difficulty: ${difficulty}.
Each question must have 4 options (A, B, C, D) and one correct answer.
Return ONLY valid JSON array format:
[
  {
    "question": "Question text?",
    "options": ["A", "B", "C", "D"],
    "correctIndex": 0
  }
]
correctIndex must be 0-3.`;

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "You are a quiz generator. Return ONLY valid JSON array. No explanations.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    });

    const content = response.choices[0].message.content;
    console.log(`🤖 OpenAI raw response: ${content.substring(0, 100)}...`);

    // Extract JSON from response
    const jsonMatch = content.match(/\[\s*\{[\s\S]*\}\s*\]/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON format from OpenAI");
    }

    const questions = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No questions generated");
    }

    questions.forEach((q, i) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Invalid question at index ${i}`);
      }
      if (
        typeof q.correctIndex !== "number" ||
        q.correctIndex < 0 ||
        q.correctIndex > 3
      ) {
        throw new Error(`Invalid correctIndex at index ${i}`);
      }
    });

    console.log(`✅ OpenAI: Generated ${questions.length} valid questions`);
    return questions;
  } catch (error) {
    console.error("❌ OpenAI error:", error.message);
    throw error; // Let caller handle fallback
  }
}

async function generateQuestionsWithGemini(topic, difficulty, count = 3) {
  try {
    console.log(
      `🤖 Gemini: Generating ${count} questions for "${topic}" (${difficulty})`,
    );

    // Get the Gemini model - use a valid model name
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash", // Changed from "gemini-1.5-flash"
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      },
    });

    const prompt = `Generate exactly ${count} multiple-choice quiz questions about "${topic}".
Difficulty level: ${difficulty}.

For each question:
1. Provide a clear, interesting question
2. Provide 4 answer options labeled A, B, C, D
3. Indicate the correct answer
4. Make sure the incorrect answers are plausible but clearly wrong
5. Make the questions engaging and educational

Return the response as a valid JSON array in this exact format:
[
  {
    "question": "The question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctIndex": 0
  }
]

Important: The correctIndex should be 0, 1, 2, or 3 corresponding to the correct option.
Make sure the JSON is valid and parseable.
Return ONLY the JSON array, no additional text.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const content = response.text();

    console.log(`🤖 Gemini raw response: ${content.substring(0, 100)}...`);

    // Clean the response - extract JSON from any markdown or extra text
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Invalid response format from Gemini");
    }

    const questions = JSON.parse(jsonMatch[0]);

    // Validate the questions structure
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No questions generated");
    }

    questions.forEach((q, i) => {
      if (!q.question || !Array.isArray(q.options) || q.options.length !== 4) {
        throw new Error(`Invalid question format at index ${i}`);
      }
      if (
        typeof q.correctIndex !== "number" ||
        q.correctIndex < 0 ||
        q.correctIndex > 3
      ) {
        throw new Error(`Invalid correctIndex at index ${i}`);
      }
    });

    console.log(`✅ Gemini: Generated ${questions.length} valid questions`);
    return questions;
  } catch (error) {
    console.error("❌ Gemini API error:", error.message);

    // Check if it's an API key or quota error
    if (
      error.message.includes("API key") ||
      error.message.includes("quota") ||
      error.message.includes("permission") ||
      error.message.includes("429")
    ) {
      console.log("⚠️ Gemini API issue, falling back to mock questions");
      return generateMockQuestions(topic, difficulty, count);
    }

    throw error; // Let caller handle fallback
  }
}

// Helper function to start question timer
function startQuestionTimer(roomCode, questionNumber, io) {
  console.log(
    `⏰ Starting timer for room ${roomCode}, question ${questionNumber}`,
  );

  // Get game state
  const gameState = gameStates.get(roomCode);
  if (!gameState) {
    console.error(`❌ No game state for room ${roomCode}`);
    return;
  }

  // Record start time
  gameState.questionStartTime = Date.now();

  // Send timer start to clients
  io.to(roomCode).emit("timer-start", {
    questionNumber,
    duration: 20000,
    startTime: gameState.questionStartTime,
  });

  // Clear existing timer
  if (gameState.questionTimer) {
    clearTimeout(gameState.questionTimer);
  }

  // Set timer for 20 seconds
  gameState.questionTimer = setTimeout(async () => {
    console.log(
      `⏰ Time's up for question ${questionNumber} in room ${roomCode}`,
    );

    // Send time-up event to clients
    io.to(roomCode).emit("time-up", {
      questionNumber,
      message: "Time's up!",
    });

    // Move to next question after delay
    setTimeout(() => {
      moveToNextQuestion(roomCode, questionNumber, io);
    }, 3000);
  }, 20000);
}

// Helper function to move to next question
async function moveToNextQuestion(roomCode, currentQuestionNumber, io) {
  const gameState = gameStates.get(roomCode);
  if (!gameState) return;

  const nextQuestionNumber = currentQuestionNumber + 1;

  // Check if there are more questions
  const roomResult = await pool.query(
    "SELECT id, total_questions FROM rooms WHERE code = $1",
    [roomCode],
  );

  if (roomResult.rows.length === 0) return;

  const room = roomResult.rows[0];

  if (nextQuestionNumber <= room.total_questions) {
    // More questions remain
    const questionResult = await pool.query(
      `SELECT * FROM questions 
       WHERE room_id = $1 AND round_number = $2`,
      [room.id, nextQuestionNumber],
    );

    if (questionResult.rows.length > 0) {
      const question = questionResult.rows[0];

      // Reset player answers for next question
      await pool.query(
        `UPDATE players 
         SET current_answer = -1, has_answered = false 
         WHERE room_id = $1 AND socket_id IS NOT NULL`,
        [room.id],
      );

      // Update game state
      gameState.currentQuestion = nextQuestionNumber;
      gameState.playersAnswered.clear();

      // Update room
      await pool.query("UPDATE rooms SET current_question = $1 WHERE id = $2", [
        nextQuestionNumber,
        room.id,
      ]);

      // Send next question
      io.to(roomCode).emit("new-question", {
        id: question.id,
        question: question.question_text,
        options: question.options,
        round: nextQuestionNumber,
        totalQuestions: room.total_questions,
        timeLimit: 20,
      });

      // Start timer for next question
      startQuestionTimer(roomCode, nextQuestionNumber, io);
    }
  } else {
    // All questions completed
    await pool.query("UPDATE rooms SET status = $1 WHERE id = $2", [
      "completed",
      room.id,
    ]);

    // Get final scores
    const scoresResult = await pool.query(
      `SELECT username, score 
       FROM players WHERE room_id = $1 AND socket_id IS NOT NULL
       ORDER BY score DESC`,
      [room.id],
    );

    // Send game completed event
    io.to(roomCode).emit("game-completed", {
      leaderboard: scoresResult.rows,
      topic: gameState.topic,
      difficulty: gameState.difficulty,
    });

    // Reset game state
    gameState.gameStarted = false;
    gameState.currentQuestion = 1;
    gameState.playersAnswered.clear();
    gameState.questionStartTime = null;

    // Clear timer
    if (gameState.questionTimer) {
      clearTimeout(gameState.questionTimer);
      gameState.questionTimer = null;
    }
  }
}

// Get or generate room id for a code
async function getOrGenerateRoomId(code) {
  const result = await pool.query("SELECT id FROM rooms WHERE code = $1", [
    code,
  ]);

  if (result.rows.length > 0) {
    return result.rows[0].id;
  }

  // Generate a new room with this code (if needed)
  const newRoomResult = await pool.query(
    `INSERT INTO rooms (code, host_username, current_players) 
     VALUES ($1, 'System', 0) 
     RETURNING id`,
    [code],
  );

  return newRoomResult.rows[0].id;
}

// Initialize game state for room
async function initializeGameState(roomCode) {
  const roomResult = await pool.query("SELECT * FROM rooms WHERE code = $1", [
    roomCode,
  ]);

  if (roomResult.rows.length === 0) return null;

  const room = roomResult.rows[0];
  const gameState = {
    roomId: room.id,
    currentQuestion: room.current_question || 1,
    totalQuestions: room.total_questions || 3,
    questionTimer: null,
    playersAnswered: new Set(),
    gameStarted: room.status === "active",
    topic: room.topic,
    difficulty: room.difficulty,
    questionStartTime: null,
  };

  gameStates.set(roomCode, gameState);
  return gameState;
}

io.on("connection", async (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Create a new room
  socket.on("create-room", async (username, callback) => {
    try {
      if (!isValidUsername(username)) {
        throw new Error("Username must be 2-20 characters");
      }

      const client = await pool.connect();
      try {
        // Generate unique room code
        let roomCode;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;

        while (!isUnique && attempts < maxAttempts) {
          roomCode = generateRoomCode();
          const checkResult = await client.query(
            "SELECT code FROM rooms WHERE code = $1",
            [roomCode],
          );
          isUnique = checkResult.rows.length === 0;
          attempts++;
        }

        if (!isUnique) {
          throw new Error(
            "Failed to generate unique room code. Please try again.",
          );
        }

        await client.query("BEGIN");

        // Create room
        const roomResult = await client.query(
          `INSERT INTO rooms (code, host_socket_id, host_username, current_players, status) 
           VALUES ($1, $2, $3, 1, 'waiting') 
           RETURNING id, code, host_username, topic, difficulty, status, current_players, max_players`,
          [roomCode, socket.id, username.trim()],
        );

        // Add host as player
        const playerResult = await client.query(
          `INSERT INTO players (room_id, username, socket_id, is_host) 
           VALUES ($1, $2, $3, true) 
           RETURNING id, username, score, is_ready, is_host, current_answer, has_answered`,
          [roomResult.rows[0].id, username.trim(), socket.id],
        );

        await client.query("COMMIT");

        // Join socket room
        socket.join(roomCode);

        // Store user data
        socket.userData = {
          playerId: playerResult.rows[0].id,
          username: username.trim(),
          roomCode: roomCode,
          isHost: true,
        };

        // Initialize game state
        const gameState = await initializeGameState(roomCode);

        // Store connection in room
        if (!roomConnections.has(roomCode)) {
          roomConnections.set(roomCode, new Map());
        }
        roomConnections.get(roomCode).set(socket.id, {
          playerId: playerResult.rows[0].id,
          username: username.trim(),
          joinedAt: new Date(),
        });

        callback({
          success: true,
          roomCode: roomCode,
          playerId: playerResult.rows[0].id,
          isHost: true,
          players: [playerResult.rows[0]],
          room: roomResult.rows[0],
          gameState: gameState,
        });

        console.log(`✅ Room created: ${roomCode} by ${username}`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Create room error:", error);
      callback({
        success: false,
        error: error.message,
      });
    }
  });

  // Join existing room
  socket.on("join-room", async ({ roomCode, username }, callback) => {
    try {
      if (!isValidUsername(username)) {
        throw new Error("Username must be 2-20 characters");
      }

      if (!roomCode || roomCode.length !== 6) {
        throw new Error("Invalid room code");
      }

      roomCode = roomCode.toUpperCase();
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Get room - allow joining active rooms too
        const roomResult = await client.query(
          `SELECT * FROM rooms 
           WHERE code = $1 AND expires_at > NOW()`,
          [roomCode],
        );

        if (roomResult.rows.length === 0) {
          throw new Error("Room not found or expired");
        }

        const room = roomResult.rows[0];

        // Check room capacity
        if (room.current_players >= room.max_players) {
          throw new Error("Room is full");
        }

        // Check if username exists in room (active players only)
        const existingPlayer = await client.query(
          `SELECT username FROM players 
           WHERE room_id = $1 AND username = $2 AND socket_id IS NOT NULL`,
          [room.id, username.trim()],
        );

        if (existingPlayer.rows.length > 0) {
          throw new Error("Username already taken in this room");
        }

        // Check if user was previously in this room (reconnection)
        const previousPlayer = await client.query(
          `SELECT id, username, score, is_host, current_answer, has_answered 
           FROM players 
           WHERE room_id = $1 AND username = $2 AND socket_id IS NULL`,
          [room.id, username.trim()],
        );

        let playerResult;

        if (previousPlayer.rows.length > 0) {
          // Reconnect existing player
          playerResult = await client.query(
            `UPDATE players 
             SET socket_id = $1, joined_at = NOW(), last_active = NOW()
             WHERE id = $2 
             RETURNING id, username, score, is_ready, is_host, current_answer, has_answered`,
            [socket.id, previousPlayer.rows[0].id],
          );
        } else {
          // Add new player
          playerResult = await client.query(
            `INSERT INTO players (room_id, username, socket_id, is_host) 
             VALUES ($1, $2, $3, false) 
             RETURNING id, username, score, is_ready, is_host, current_answer, has_answered`,
            [room.id, username.trim(), socket.id],
          );

          // Update room player count only for new players
          await client.query(
            "UPDATE rooms SET current_players = current_players + 1 WHERE id = $1",
            [room.id],
          );
        }

        // Get all active players in room
        const playersResult = await client.query(
          `SELECT id, username, score, is_ready, is_host, current_answer, has_answered 
           FROM players 
           WHERE room_id = $1 AND socket_id IS NOT NULL
           ORDER BY joined_at`,
          [room.id],
        );

        await client.query("COMMIT");

        // Join socket room
        socket.join(room.code);

        // Store user data
        socket.userData = {
          playerId: playerResult.rows[0].id,
          username: username.trim(),
          roomCode: room.code,
          isHost: playerResult.rows[0].is_host,
        };

        // Store connection in room
        if (!roomConnections.has(roomCode)) {
          roomConnections.set(roomCode, new Map());
        }
        roomConnections.get(roomCode).set(socket.id, {
          playerId: playerResult.rows[0].id,
          username: username.trim(),
          joinedAt: new Date(),
        });

        // Get or initialize game state
        let gameState = gameStates.get(roomCode);
        if (!gameState) {
          gameState = await initializeGameState(roomCode);
        }

        // Get current question if game is active
        let currentQuestion = null;
        if (room.status === "active") {
          // Get current question and time remaining
          const currentTime = Date.now();
          const questionStartTime = gameState.questionStartTime || currentTime;
          const timeElapsed = currentTime - questionStartTime;
          const timeLeft = Math.max(0, 20000 - timeElapsed);

          responseData.currentQuestion = currentQuestion;
          responseData.timeLeft = Math.ceil(timeLeft / 1000);
          responseData.questionStartTime = questionStartTime;
        }
        if (room.status === "active" && gameState) {
          const questionResult = await client.query(
            `SELECT * FROM questions 
             WHERE room_id = $1 AND round_number = $2`,
            [room.id, gameState.currentQuestion],
          );

          if (questionResult.rows.length > 0) {
            currentQuestion = questionResult.rows[0];
          }
        }

        const responseData = {
          success: true,
          roomCode: room.code,
          playerId: playerResult.rows[0].id,
          isHost: playerResult.rows[0].is_host,
          players: playersResult.rows,
          room: {
            ...room,
            current_players: playersResult.rows.length,
          },
          gameState: gameState,
          currentQuestion: currentQuestion,
        };

        // If game is active, include time left
        if (
          room.status === "active" &&
          gameState &&
          gameState.questionStartTime
        ) {
          const timeElapsed = Date.now() - gameState.questionStartTime;
          const timeLeft = Math.max(0, 20000 - timeElapsed); // 20 seconds total
          responseData.timeLeft = Math.ceil(timeLeft / 1000);
        }

        // Notify the joiner
        callback(responseData);

        // Notify others in the room (except for reconnections)
        if (previousPlayer.rows.length === 0) {
          socket.to(room.code).emit("player-joined", {
            username: username.trim(),
            players: playersResult.rows,
            room: {
              code: room.code,
              currentPlayers: playersResult.rows.length,
              maxPlayers: room.max_players,
            },
          });
        }

        console.log(
          `✅ ${username} joined room: ${roomCode} (Status: ${room.status})`,
        );
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Join room error:", error);
      callback({
        success: false,
        error: error.message,
      });
    }
  });

  // Start game (host only) - allows single player
  socket.on("start-game", async ({ topic, difficulty }, callback) => {
    console.log("🎮 Start game requested:", {
      topic,
      difficulty,
      userData: socket.userData,
      socketId: socket.id,
      timestamp: new Date().toISOString(),
    });

    try {
      // Validate user data
      if (!socket.userData || !socket.userData.roomCode) {
        console.error("❌ No user data or room code");
        throw new Error("Not connected to a room");
      }

      if (!socket.userData.isHost) {
        console.error("❌ User is not host:", socket.userData);
        throw new Error("Only host can start the game");
      }

      const { roomCode } = socket.userData;
      console.log(`🔍 Starting game for room: ${roomCode}`);

      const client = await pool.connect();
      console.log("✅ Got database client");

      try {
        await client.query("BEGIN");
        console.log("✅ Started transaction");

        // 1. First, check room exists and get current status
        console.log(`📊 Checking room status for: ${roomCode}`);
        const roomCheck = await client.query(
          "SELECT id, status, current_players FROM rooms WHERE code = $1",
          [roomCode],
        );

        if (roomCheck.rows.length === 0) {
          throw new Error("Room not found");
        }

        const room = roomCheck.rows[0];
        console.log(
          `📊 Room found: ID=${room.id}, Status=${room.status}, Players=${room.current_players}`,
        );

        // Allow starting if room is in "waiting" status
        if (room.status === "active") {
          throw new Error("Game already started");
        }

        // 2. Get all active players
        console.log("👥 Getting active players...");
        const playersResult = await client.query(
          `SELECT id, username, score, is_host, socket_id
         FROM players 
         WHERE room_id = $1 AND socket_id IS NOT NULL`,
          [room.id],
        );

        console.log(`👥 Found ${playersResult.rows.length} active players`);

        // 3. Generate questions with timeout protection
        console.log(
          `🤖 Generating questions for topic: "${topic}" (difficulty: ${difficulty})`,
        );
        const startTime = Date.now();

        let questions;
        try {
          // Add timeout for question generation
          const generatePromise = generateQuestionsWithGemini(
            topic,
            difficulty,
            3,
          );
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("Question generation timed out (10s)")),
              10000,
            );
          });

          questions = await Promise.race([generatePromise, timeoutPromise]);
          const genTime = Date.now() - startTime;
          console.log(
            `✅ Generated ${questions.length} questions in ${genTime}ms`,
          );
        } catch (error) {
          console.error("❌ Question generation error:", error.message);
          // Fallback to mock questions
          console.log("⚠️ Using mock questions as fallback");
          questions = generateMockQuestions(topic, difficulty, 3);
        }

        // 4. Update room status
        console.log("📝 Updating room status to active...");
        const roomResult = await client.query(
          `UPDATE rooms 
         SET status = 'active', topic = $1, difficulty = $2, 
             game_started_at = NOW(), current_question = 1
         WHERE id = $3 
         RETURNING id, code, topic, difficulty, status, current_question`,
          [topic, difficulty, room.id],
        );

        // 5. Delete any existing questions for this room
        console.log("🗑️ Cleaning up old questions...");
        await client.query("DELETE FROM questions WHERE room_id = $1", [
          room.id,
        ]);

        // 6. Save new questions to database
        console.log("💾 Saving questions to database...");
        for (let i = 0; i < questions.length; i++) {
          const question = questions[i];
          console.log(
            `  Saving question ${i + 1}: "${question.question.substring(0, 50)}..."`,
          );

          await client.query(
            `INSERT INTO questions (room_id, question_text, options, correct_index, round_number, topic, difficulty) 
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              room.id,
              question.question,
              JSON.stringify(question.options),
              question.correctIndex,
              i + 1,
              topic,
              difficulty,
            ],
          );
        }

        // 7. Reset player answers
        console.log("🔄 Resetting player answers...");
        await client.query(
          `UPDATE players 
         SET current_answer = -1, has_answered = false 
         WHERE room_id = $1`,
          [room.id],
        );

        await client.query("COMMIT");
        console.log("✅ Transaction committed successfully");

        // 8. Get the first question
        console.log("📋 Getting first question...");
        const questionResult = await pool.query(
          `SELECT * FROM questions WHERE room_id = $1 AND round_number = 1`,
          [room.id],
        );

        if (questionResult.rows.length === 0) {
          throw new Error("Failed to retrieve generated questions");
        }

        const question = questionResult.rows[0];
        console.log(
          `📋 First question: "${question.question_text.substring(0, 50)}..."`,
        );

        // 9. Prepare player data for clients
        const playerData = playersResult.rows.map((p) => ({
          id: p.socket_id,
          username: p.username,
          score: p.score || 0,
          isHost: p.is_host,
          currentAnswer: -1,
          hasAnswered: false,
        }));

        // 10. Initialize or update game state
        const gameState = {
          roomId: room.id,
          currentQuestion: 1,
          totalQuestions: 3,
          topic: topic,
          difficulty: difficulty,
          playersAnswered: new Set(),
          gameStarted: true,
          questionStartTime: null,
          questionTimer: null,
        };
        gameStates.set(roomCode, gameState);

        // 11. Send game started event to all players
        console.log(
          `📤 Emitting game-started to room ${roomCode} (${playersResult.rows.length} players)`,
        );
        io.to(roomCode).emit("game-started", {
          success: true,
          topic: topic,
          difficulty: difficulty,
          totalQuestions: 3,
          currentQuestion: 1,
          players: playerData,
        });

        // 12. Send first question
        console.log(`📤 Sending first question to room ${roomCode}`);
        io.to(roomCode).emit("new-question", {
          id: question.id,
          question: question.question_text,
          options: question.options,
          round: 1,
          totalQuestions: 3,
          timeLimit: 20,
        });

        // 13. Start timer for this question
        console.log("⏰ Starting question timer...");
        startQuestionTimer(roomCode, 1, io);

        // 14. Send success response to host immediately
        console.log("✅ Sending success callback to host");
        callback({
          success: true,
          message: "Game started successfully",
          topic: topic,
          difficulty: difficulty,
          players: playerData.length,
        });

        console.log(`🎮 Game started successfully in room: ${roomCode}`);
      } catch (error) {
        console.error("❌ Transaction error:", error.message, error.stack);
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
        console.log("✅ Released database client");
      }
    } catch (error) {
      console.error("❌ Start game error:", error.message, error.stack);
      callback({
        success: false,
        error: error.message,
      });
    }
  });

  // Player submits answer - FIXED LOG STATEMENT
  socket.on(
    "submit-answer",
    async ({ questionId, answerIndex, responseTime }, callback) => {
      console.log("📝 Submit answer:", {
        questionId,
        answerIndex,
        responseTime,
        userData: socket.userData,
        timestamp: new Date().toISOString(),
      });

      try {
        if (
          !socket.userData ||
          !socket.userData.roomCode ||
          !socket.userData.playerId
        ) {
          console.error(
            "❌ Unauthorized submit answer attempt:",
            socket.userData,
          );
          throw new Error("Player not properly joined");
        }

        const { roomCode, playerId } = socket.userData;
        console.log(`🔍 Checking room: ${roomCode}`);

        const client = await pool.connect();
        console.log("✅ Got database client");

        try {
          await client.query("BEGIN");
          console.log("✅ Started transaction");

          // Get question
          const questionResult = await client.query(
            `SELECT * FROM questions WHERE id = $1`,
            [questionId],
          );

          if (questionResult.rows.length === 0) {
            throw new Error("Question not found");
          }

          const question = questionResult.rows[0];
          const isCorrect = answerIndex === question.correct_index;

          // Save answer
          await client.query(
            `INSERT INTO answers (player_id, question_id, selected_index, is_correct, response_time) 
           VALUES ($1, $2, $3, $4, $5)`,
            [playerId, questionId, answerIndex, isCorrect, responseTime],
          );

          // Update player score if correct
          if (isCorrect) {
            await client.query(
              `UPDATE players SET score = score + 10 WHERE id = $1`,
              [playerId],
            );
          }

          callback({
            success: true,
            isCorrect: isCorrect,
            // Don't send correctAnswer here yet
            playerScore: playerResult.rows[0].score,
            responseTime: responseTime,
          });

          // Only reveal answer when timer ends
          // In the timer callback function:
          setTimeout(async () => {
            // Send correct answer to all players
            io.to(roomCode).emit("reveal-answer", {
              questionNumber: currentQuestionNumber,
              correctAnswer: question.correct_index,
              explanation: "Time's up! The correct answer was...",
            });

            // Then move to next question after delay
            setTimeout(() => {
              moveToNextQuestion(roomCode, currentQuestionNumber, io);
            }, 5000);
          }, 20000);

          // Mark player as answered for this question
          await client.query(
            `UPDATE players SET current_answer = $1, has_answered = true WHERE id = $2`,
            [answerIndex, playerId],
          );

          // Get updated player info
          const playerResult = await client.query(
            `SELECT username, score FROM players WHERE id = $1`,
            [playerId],
          );

          // Get room scores
          const scoresResult = await client.query(
            `SELECT p.username, p.score, p.has_answered 
           FROM players p 
           JOIN rooms r ON p.room_id = r.id 
           WHERE r.code = $1 AND p.socket_id IS NOT NULL
           ORDER BY p.score DESC`,
            [roomCode],
          );

          await client.query("COMMIT");

          // Update game state
          const gameState = gameStates.get(roomCode);
          if (gameState) {
            gameState.playersAnswered.add(playerId);

            // Check if all active players have answered
            const activePlayers = scoresResult.rows.length;
            const answeredPlayers = scoresResult.rows.filter(
              (p) => p.has_answered,
            ).length;

            if (answeredPlayers === activePlayers) {
              // All active players answered, move to next question
              setTimeout(() => {
                moveToNextQuestion(roomCode, question.round_number, io);
              }, 2000); // 2 second delay to show results
            }
          }

          // Send feedback to player
          callback({
            success: true,
            isCorrect: isCorrect,
            correctAnswer: question.correct_index,
            playerScore: playerResult.rows[0].score,
            responseTime: responseTime,
          });

          // Update scores for all players
          io.to(roomCode).emit("score-update", {
            scores: scoresResult.rows.map((p) => ({
              username: p.username,
              score: p.score,
              hasAnswered: p.has_answered,
            })),
          });

          console.log(
            `📝 Answer submitted by ${socket.userData.username} in room ${roomCode}`,
          );
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      } catch (error) {
        console.error("Submit answer error:", error);
        callback({
          success: false,
          error: error.message,
        });
      }
    },
  );

  // Host starts next round
  socket.on("start-next-round", async ({ topic, difficulty }, callback) => {
    try {
      if (
        !socket.userData ||
        !socket.userData.roomCode ||
        !socket.userData.isHost
      ) {
        throw new Error("Only host can start next round");
      }

      const { roomCode } = socket.userData;
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        // Validate topic with Gemini
        try {
          await generateQuestionsWithGemini(topic, difficulty, 1);
        } catch (error) {
          throw new Error(`Invalid topic: ${error.message}`);
        }

        // Generate new questions
        const questions = await generateQuestionsWithGemini(
          topic,
          difficulty,
          3,
        );

        // Reset player answers for new round
        await client.query(
          `UPDATE players 
           SET current_answer = -1, has_answered = false 
           WHERE room_id = (SELECT id FROM rooms WHERE code = $1)`,
          [roomCode],
        );

        // Delete old questions
        await client.query(
          `DELETE FROM questions 
           WHERE room_id = (SELECT id FROM rooms WHERE code = $1)`,
          [roomCode],
        );

        // Update room for new round
        const roomResult = await client.query(
          `UPDATE rooms 
           SET topic = $1, difficulty = $2, current_question = 1, 
               game_round = COALESCE(game_round, 0) + 1, game_started_at = NOW() 
           WHERE code = $3 
           RETURNING *`,
          [topic, difficulty, roomCode],
        );

        // Save new questions
        for (let i = 0; i < questions.length; i++) {
          await client.query(
            `INSERT INTO questions (room_id, question_text, options, correct_index, round_number, topic, difficulty) 
             VALUES ((SELECT id FROM rooms WHERE code = $1), $2, $3, $4, $5, $6, $7)`,
            [
              roomCode,
              questions[i].question,
              JSON.stringify(questions[i].options),
              questions[i].correctIndex,
              i + 1,
              topic,
              difficulty,
            ],
          );
        }

        await client.query("COMMIT");

        // Reset game state
        const gameState = gameStates.get(roomCode);
        if (gameState) {
          gameState.currentQuestion = 1;
          gameState.playersAnswered.clear();
          gameState.topic = topic;
          gameState.difficulty = difficulty;
          gameState.questionStartTime = Date.now();
        }

        // Get first question of new round
        const questionResult = await pool.query(
          `SELECT q.* FROM questions q 
           JOIN rooms r ON q.room_id = r.id 
           WHERE r.code = $1 AND q.round_number = 1`,
          [roomCode],
        );

        if (questionResult.rows.length > 0) {
          const question = questionResult.rows[0];

          // Notify all players about new round
          io.to(roomCode).emit("next-round-started", {
            topic: topic,
            difficulty: difficulty,
            round: roomResult.rows[0].game_round || 1,
            totalQuestions: 3,
          });

          // Send first question after delay
          setTimeout(() => {
            io.to(roomCode).emit("new-question", {
              id: question.id,
              question: question.question_text,
              options: question.options,
              round: 1,
              totalQuestions: 3,
              timeLimit: 20,
            });

            // Start timer
            startQuestionTimer(roomCode, 1, io);
          }, 3000); // 3 second delay before starting new round

          callback({
            success: true,
            message: "Next round started successfully",
          });
        }

        console.log(
          `🔄 Next round started in room: ${roomCode}, Topic: ${topic}`,
        );
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error("Start next round error:", error);
      callback({
        success: false,
        error: error.message,
      });
    }
  });

  // Player leaves room
  socket.on("leave-room", async (callback) => {
    try {
      if (socket.userData && socket.userData.roomCode) {
        const { roomCode, username, playerId, isHost } = socket.userData;

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Mark player as disconnected (set socket_id to null)
          await client.query(
            `UPDATE players SET socket_id = NULL, last_active = NOW() WHERE id = $1`,
            [playerId],
          );

          // If host is leaving, delete the entire room
          if (isHost) {
            console.log(
              `👑 Host ${username} is leaving room ${roomCode} - deleting room...`,
            );

            // Delete the room (CASCADE will delete players, questions, answers)
            await client.query(
              `DELETE FROM rooms WHERE code = $1 RETURNING id`,
              [roomCode],
            );

            // Remove from room connections
            if (roomConnections.has(roomCode)) {
              roomConnections.delete(roomCode);
            }

            // Remove game state
            gameStates.delete(roomCode);

            console.log(`🗑️ Room ${roomCode} deleted because host left`);
          } else {
            // Regular player leaving, just update counts
            await client.query(
              `UPDATE rooms 
             SET current_players = GREATEST(0, current_players - 1) 
             WHERE code = $1 AND current_players > 0`,
              [roomCode],
            );

            // Remove from room connections
            if (roomConnections.has(roomCode)) {
              roomConnections.get(roomCode).delete(socket.id);
            }
          }

          await client.query("COMMIT");

          // Notify others (if room still exists)
          if (!isHost) {
            socket.to(roomCode).emit("player-left", {
              username: username,
              message: `${username} left the room`,
            });
          } else {
            // If host left, notify all players that room is closing
            socket.to(roomCode).emit("room-closed", {
              message: "Host left the room. Room is closing.",
              reason: "host_left",
            });
          }

          socket.leave(roomCode);

          // Clear user data
          delete socket.userData;

          console.log(
            `👋 ${username} ${isHost ? "(host)" : ""} left room: ${roomCode}`,
          );

          if (callback) {
            callback({
              success: true,
              roomDeleted: isHost,
              message: isHost ? "Room deleted" : "Left room",
            });
          }
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      }
    } catch (error) {
      console.error("Leave room error:", error);
      if (callback) {
        callback({ success: false, error: error.message });
      }
    }
  });

  // Reconnect to room
  socket.on("reconnect-room", async ({ roomCode, username }, callback) => {
    try {
      if (!roomCode || !username) {
        throw new Error("Room code and username required");
      }

      roomCode = roomCode.toUpperCase();

      // Check if player exists in room with null socket_id (disconnected)
      const playerResult = await pool.query(
        `SELECT p.id, p.username, p.score, p.is_host, r.status, r.topic, r.difficulty
         FROM players p
         JOIN rooms r ON p.room_id = r.id
         WHERE r.code = $1 AND p.username = $2 AND p.socket_id IS NULL`,
        [roomCode, username],
      );

      if (playerResult.rows.length === 0) {
        throw new Error("No disconnected player found with that username");
      }

      const player = playerResult.rows[0];

      // Update player socket
      await pool.query(
        `UPDATE players SET socket_id = $1, last_active = NOW() WHERE id = $2`,
        [socket.id, player.id],
      );

      // Get room info
      const roomResult = await pool.query(
        "SELECT * FROM rooms WHERE code = $1",
        [roomCode],
      );

      if (roomResult.rows.length === 0) {
        throw new Error("Room not found");
      }

      const room = roomResult.rows[0];

      // Get all active players
      const playersResult = await pool.query(
        `SELECT id, username, score, is_ready, is_host, current_answer, has_answered 
         FROM players 
         WHERE room_id = $1 AND socket_id IS NOT NULL
         ORDER BY joined_at`,
        [room.id],
      );

      // Join socket room
      socket.join(roomCode);

      // Store user data
      socket.userData = {
        playerId: player.id,
        username: username,
        roomCode: roomCode,
        isHost: player.is_host,
      };

      // Store connection
      if (!roomConnections.has(roomCode)) {
        roomConnections.set(roomCode, new Map());
      }
      roomConnections.get(roomCode).set(socket.id, {
        playerId: player.id,
        username: username,
        joinedAt: new Date(),
      });

      // Get game state and current question
      let gameState = gameStates.get(roomCode);
      let currentQuestion = null;
      let timeLeft = null;

      if (room.status === "active") {
        if (!gameState) {
          gameState = await initializeGameState(roomCode);
        }

        // Get current question
        const questionResult = await pool.query(
          `SELECT * FROM questions 
           WHERE room_id = $1 AND round_number = $2`,
          [room.id, gameState.currentQuestion],
        );

        if (questionResult.rows.length > 0) {
          currentQuestion = questionResult.rows[0];

          // Calculate time left
          if (gameState.questionStartTime) {
            const timeElapsed = Date.now() - gameState.questionStartTime;
            timeLeft = Math.max(0, 20000 - timeElapsed);
          }
        }
      }

      const responseData = {
        success: true,
        roomCode: room.code,
        playerId: player.id,
        isHost: player.is_host,
        players: playersResult.rows,
        room: {
          ...room,
          current_players: playersResult.rows.length,
        },
        gameState: gameState,
        currentQuestion: currentQuestion,
        reconnected: true,
      };

      if (timeLeft !== null) {
        responseData.timeLeft = Math.ceil(timeLeft / 1000);
      }

      callback(responseData);

      // Notify others about reconnection
      socket.to(roomCode).emit("player-reconnected", {
        username: username,
        players: playersResult.rows,
      });

      console.log(`🔁 ${username} reconnected to room: ${roomCode}`);
    } catch (error) {
      console.error("Reconnect error:", error);
      callback({
        success: false,
        error: error.message,
      });
    }
  });

  // Get active rooms
  socket.on("get-active-rooms", async (callback) => {
    try {
      const result = await pool.query(`
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
        WHERE r.status IN ('waiting', 'active') 
          AND r.expires_at > NOW()
        GROUP BY r.id, r.code, r.host_username, r.topic, r.difficulty, 
                 r.status, r.current_players, r.max_players, r.created_at
        ORDER BY r.created_at DESC
        LIMIT 50
      `);

      callback({
        success: true,
        rooms: result.rows,
      });
    } catch (error) {
      console.error("Get active rooms error:", error);
      callback({
        success: false,
        error: error.message,
      });
    }
  });

  // Check room availability
  socket.on("check-room", async ({ roomCode }, callback) => {
    try {
      if (!roomCode || roomCode.length !== 6) {
        throw new Error("Invalid room code");
      }

      const result = await pool.query(
        `SELECT 
          r.code,
          r.status,
          r.current_players,
          r.max_players,
          r.expires_at,
          COUNT(p.id) as active_players
         FROM rooms r
         LEFT JOIN players p ON r.id = p.room_id AND p.socket_id IS NOT NULL
         WHERE r.code = $1
         GROUP BY r.id`,
        [roomCode.toUpperCase()],
      );

      if (result.rows.length === 0) {
        callback({ success: true, exists: false });
      } else {
        const room = result.rows[0];
        const isFull = room.active_players >= room.max_players;
        const isExpired = new Date(room.expires_at) < new Date();

        callback({
          success: true,
          exists: true,
          room: {
            code: room.code,
            status: room.status,
            currentPlayers: room.active_players,
            maxPlayers: room.max_players,
            isFull: isFull,
            isExpired: isExpired,
          },
        });
      }
    } catch (error) {
      console.error("Check room error:", error);
      callback({
        success: false,
        error: error.message,
      });
    }
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);

    try {
      if (socket.userData && socket.userData.roomCode) {
        const { roomCode, username, playerId, isHost } = socket.userData;

        const client = await pool.connect();
        try {
          await client.query("BEGIN");

          // Mark player as disconnected
          await client.query(
            `UPDATE players SET socket_id = NULL, last_active = NOW() WHERE id = $1`,
            [playerId],
          );

          // Update room connections
          if (roomConnections.has(roomCode)) {
            roomConnections.get(roomCode).delete(socket.id);
          }

          // Check if room has any active connections
          const connections = roomConnections.get(roomCode);
          const hasActiveConnections = connections && connections.size > 0;

          if (!hasActiveConnections) {
            // No active connections, delete the room immediately
            console.log(
              `🏚️ Room ${roomCode} has no active connections - deleting...`,
            );
            await client.query(`DELETE FROM rooms WHERE code = $1`, [roomCode]);

            // Clean up game state
            gameStates.delete(roomCode);
            roomConnections.delete(roomCode);

            console.log(`✅ Room ${roomCode} deleted (no active connections)`);
          } else if (isHost) {
            // Host disconnected but other players still connected
            console.log(
              `👑 Host ${username} disconnected from room ${roomCode}, ${connections.size} players remain`,
            );

            // Notify remaining players
            socket.to(roomCode).emit("host-disconnected", {
              username: username,
              message:
                "Host disconnected. Room will remain open for other players.",
              remainingPlayers: connections.size,
            });

            // The cleanup function will handle promoting a new host or deleting if no host
          }

          await client.query("COMMIT");

          // Notify others about disconnection (if room still exists)
          if (hasActiveConnections && socket.userData && !isHost) {
            socket.to(roomCode).emit("player-disconnected", {
              username: username,
              message: `${username} disconnected`,
            });
          }
        } catch (error) {
          await client.query("ROLLBACK");
          console.error("Disconnect cleanup error:", error);
        } finally {
          client.release();
        }
      }
    } catch (error) {
      console.error("Disconnect cleanup error:", error);
    }
  });
});

// Cleanup old rooms periodically
setInterval(async () => {
  try {
    // Delete rooms older than 24 hours
    const result = await pool.query(
      "DELETE FROM rooms WHERE expires_at < NOW() - INTERVAL '24 hours' RETURNING code",
    );

    if (result.rows.length > 0) {
      console.log(`🧹 Cleaned up ${result.rows.length} old rooms`);
    }
  } catch (error) {
    console.error("Cleanup error:", error);
  }
}, 3600000); // Run every hour

// Start server
async function startServer() {
  try {
    const PORT = process.env.PORT || 8080;

    server.listen(PORT, () => {
      console.log(`
🚀 QuizSmash Backend Server
─────────────────────────────
✅ REST API:  http://localhost:${PORT}/api/health
🔌 Socket.IO: ws://localhost:${PORT}
📊 Database:  ${process.env.DB_NAME || "quizsmash"}
🤖 AI:        ${process.env.GEMINI_API_KEY ? "✅ Gemini Configured" : "❌ Not configured"}
─────────────────────────────
      `);

      // Run cleanup once immediately when server starts
      console.log("🚀 Server started, running initial room cleanup...");
      cleanupEmptyOrHostlessRooms()
        .then(() => {
          console.log("✅ Initial room cleanup completed");
        })
        .catch((err) => {
          console.error("❌ Initial room cleanup failed:", err);
        });

      // Run cleanup every 2 minutes
      setInterval(
        () => {
          console.log("⏰ Running scheduled room cleanup...");
          cleanupEmptyOrHostlessRooms();
        },
        2 * 60 * 1000,
      ); // 2 minutes in milliseconds

      console.log("✅ Room cleanup scheduled to run every 2 minutes");
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error);
    process.exit(1);
  }
}

// Start the server
startServer();
