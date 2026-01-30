const { generateQuiz } = require("./openai");
const { pool } = require("./database");
const crypto = require("crypto");

function generateRoomCode() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function createRoom(hostSocketId, username) {
  const client = await pool.connect();
  try {
    const roomCode = generateRoomCode();

    await client.query("BEGIN");

    // Create room
    const roomResult = await client.query(
      "INSERT INTO rooms (code, host_socket_id) VALUES ($1, $2) RETURNING *",
      [roomCode, hostSocketId],
    );

    // Add host as player
    const playerResult = await client.query(
      "INSERT INTO players (room_id, username, socket_id) VALUES ($1, $2, $3) RETURNING *",
      [roomResult.rows[0].id, username, hostSocketId],
    );

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

async function joinRoom(roomCode, username, socketId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get room
    const roomResult = await client.query(
      "SELECT * FROM rooms WHERE code = $1 AND status = $2",
      [roomCode, "waiting"],
    );

    if (roomResult.rows.length === 0) {
      throw new Error("Room not found or already started");
    }

    const room = roomResult.rows[0];

    // Check player count
    const playerCountResult = await client.query(
      "SELECT COUNT(*) FROM players WHERE room_id = $1",
      [room.id],
    );

    if (parseInt(playerCountResult.rows[0].count) >= 4) {
      throw new Error("Room is full");
    }

    // Check if username already exists in room
    const existingPlayer = await client.query(
      "SELECT * FROM players WHERE room_id = $1 AND username = $2",
      [room.id, username],
    );

    if (existingPlayer.rows.length > 0) {
      throw new Error("Username already taken in this room");
    }

    // Add player
    const playerResult = await client.query(
      "INSERT INTO players (room_id, username, socket_id) VALUES ($1, $2, $3) RETURNING *",
      [room.id, username, socketId],
    );

    // Get all players in room
    const playersResult = await client.query(
      "SELECT id, username, score, is_ready FROM players WHERE room_id = $1 ORDER BY joined_at",
      [room.id],
    );

    await client.query("COMMIT");

    return {
      room,
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

async function startGame(roomCode, topic, difficulty) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Update room status and topic
    await client.query(
      "UPDATE rooms SET status = $1, topic = $2, difficulty = $3 WHERE code = $4 RETURNING *",
      ["active", topic, difficulty, roomCode],
    );

    // Generate quiz questions
    const questions = await generateQuiz(topic, difficulty, 3);

    // Save questions to database
    for (let i = 0; i < questions.length; i++) {
      await client.query(
        "INSERT INTO questions (room_id, question_text, options, correct_index, round_number) " +
          "SELECT id, $1, $2, $3, $4 FROM rooms WHERE code = $5",
        [
          questions[i].question,
          JSON.stringify(questions[i].options),
          questions[i].correctIndex,
          i + 1,
          roomCode,
        ],
      );
    }

    // Get room with players
    const roomResult = await client.query(
      "SELECT * FROM rooms WHERE code = $1",
      [roomCode],
    );

    const playersResult = await client.query(
      "SELECT id, username, socket_id, score FROM players WHERE room_id = $1",
      [roomResult.rows[0].id],
    );

    const questionsResult = await client.query(
      "SELECT * FROM questions WHERE room_id = $1 ORDER BY round_number",
      [roomResult.rows[0].id],
    );

    await client.query("COMMIT");

    return {
      room: roomResult.rows[0],
      players: playersResult.rows,
      questions: questionsResult.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function submitAnswer(roomCode, playerId, questionId, answerIndex) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get question
    const questionResult = await client.query(
      "SELECT * FROM questions WHERE id = $1",
      [questionId],
    );

    if (questionResult.rows.length === 0) {
      throw new Error("Question not found");
    }

    const question = questionResult.rows[0];
    const isCorrect = answerIndex === question.correct_index;

    // Save answer
    const answerResult = await client.query(
      "INSERT INTO answers (player_id, question_id, selected_index, is_correct) " +
        "VALUES ($1, $2, $3, $4) RETURNING *",
      [playerId, questionId, answerIndex, isCorrect],
    );

    // Update player score if correct
    if (isCorrect) {
      await client.query(
        "UPDATE players SET score = score + 10 WHERE id = $1 RETURNING score",
        [playerId],
      );
    }

    // Get updated player info
    const playerResult = await client.query(
      "SELECT username, score FROM players WHERE id = $1",
      [playerId],
    );

    // Get room scores
    const scoresResult = await client.query(
      "SELECT p.username, p.score FROM players p " +
        "JOIN rooms r ON p.room_id = r.id WHERE r.code = $1 ORDER BY p.score DESC",
      [roomCode],
    );

    await client.query("COMMIT");

    return {
      isCorrect,
      correctAnswer: question.correct_index,
      player: playerResult.rows[0],
      scores: scoresResult.rows,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function setupSocketHandlers(io) {
  io.on("connection", (socket) => {
    console.log(`🔌 New connection: ${socket.id}`);

    // Create a new room
    socket.on("create-room", async (username) => {
      try {
        const { room, player } = await createRoom(socket.id, username);

        socket.join(room.code);
        socket.emit("room-created", {
          roomCode: room.code,
          playerId: player.id,
          isHost: true,
        });

        console.log(`✅ Room created: ${room.code} by ${username}`);
      } catch (error) {
        socket.emit("error", { message: error.message });
        console.error("Room creation error:", error);
      }
    });

    // Join an existing room
    socket.on("join-room", async ({ roomCode, username }) => {
      try {
        const { room, player, players } = await joinRoom(
          roomCode,
          username,
          socket.id,
        );

        socket.join(room.code);

        // Notify the joiner
        socket.emit("room-joined", {
          roomCode: room.code,
          playerId: player.id,
          players,
          isHost: false,
        });

        // Notify everyone in the room (except the joiner)
        socket.to(room.code).emit("player-joined", {
          username,
          players,
        });

        console.log(`✅ ${username} joined room: ${roomCode}`);
      } catch (error) {
        socket.emit("error", { message: error.message });
        console.error("Join room error:", error);
      }
    });

    // Host starts the game
    socket.on("start-game", async ({ roomCode, topic, difficulty }) => {
      try {
        const { room, players, questions } = await startGame(
          roomCode,
          topic,
          difficulty,
        );

        // Send first question to all players
        const firstQuestion = questions[0];
        io.to(roomCode).emit("game-started", {
          topic,
          difficulty,
          totalQuestions: questions.length,
          firstQuestion: {
            id: firstQuestion.id,
            question: firstQuestion.question_text,
            options: firstQuestion.options,
            round: 1,
          },
          players,
        });

        console.log(`🎮 Game started in room: ${roomCode}, Topic: ${topic}`);
      } catch (error) {
        socket.emit("error", { message: error.message });
        console.error("Start game error:", error);
      }
    });

    // Player submits answer
    socket.on(
      "submit-answer",
      async ({ roomCode, playerId, questionId, answerIndex }) => {
        try {
          const result = await submitAnswer(
            roomCode,
            playerId,
            questionId,
            answerIndex,
          );

          // Send feedback to the player
          socket.emit("answer-feedback", {
            isCorrect: result.isCorrect,
            correctAnswer: result.correctAnswer,
            playerScore: result.player.score,
          });

          // Update scores for all players
          io.to(roomCode).emit("score-update", {
            scores: result.scores,
          });

          console.log(`📝 Answer submitted by player ${playerId}`);
        } catch (error) {
          socket.emit("error", { message: error.message });
          console.error("Submit answer error:", error);
        }
      },
    );

    // Next question
    socket.on("next-question", async ({ roomCode, currentRound }) => {
      try {
        const roomResult = await pool.query(
          "SELECT * FROM rooms WHERE code = $1",
          [roomCode],
        );

        const questionsResult = await pool.query(
          "SELECT * FROM questions WHERE room_id = $1 AND round_number = $2",
          [roomResult.rows[0].id, currentRound + 1],
        );

        if (questionsResult.rows.length > 0) {
          const question = questionsResult.rows[0];
          io.to(roomCode).emit("next-question", {
            id: question.id,
            question: question.question_text,
            options: question.options,
            round: currentRound + 1,
          });
        } else {
          // Game completed
          const scoresResult = await pool.query(
            "SELECT p.username, p.score FROM players p " +
              "JOIN rooms r ON p.room_id = r.id WHERE r.code = $1 ORDER BY p.score DESC",
            [roomCode],
          );

          // Update room status
          await pool.query("UPDATE rooms SET status = $1 WHERE code = $2", [
            "completed",
            roomCode,
          ]);

          io.to(roomCode).emit("game-completed", {
            leaderboard: scoresResult.rows,
          });
        }
      } catch (error) {
        socket.emit("error", { message: error.message });
        console.error("Next question error:", error);
      }
    });

    // Player ready status
    socket.on("player-ready", async ({ roomCode, playerId }) => {
      try {
        await pool.query("UPDATE players SET is_ready = true WHERE id = $1", [
          playerId,
        ]);

        // Check if all players are ready
        const playersResult = await pool.query(
          "SELECT COUNT(*) as total, SUM(CASE WHEN is_ready THEN 1 ELSE 0 END) as ready_count " +
            "FROM players p JOIN rooms r ON p.room_id = r.id WHERE r.code = $1",
          [roomCode],
        );

        const { total, ready_count } = playersResult.rows[0];

        if (parseInt(ready_count) === parseInt(total)) {
          io.to(roomCode).emit("all-players-ready");
        }
      } catch (error) {
        console.error("Player ready error:", error);
      }
    });

    // Disconnect
    socket.on("disconnect", async () => {
      console.log(`🔌 Disconnected: ${socket.id}`);

      try {
        // Remove player from database
        await pool.query("DELETE FROM players WHERE socket_id = $1", [
          socket.id,
        ]);
      } catch (error) {
        console.error("Disconnect cleanup error:", error);
      }
    });
  });
}

module.exports = { setupSocketHandlers };
