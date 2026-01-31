const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const server = http.createServer(app);

// Database connection
const pool = new Pool({
  user: process.env.DB_USER || 'quizuser',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'quizsmash',
  password: process.env.DB_PASSWORD || 'quizpass',
  port: process.env.DB_PORT || 5432,
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection error:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

// CORS setup
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST']
}));
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'QuizSmash Backend Running',
    timestamp: new Date().toISOString(),
    database: 'connected'
  });
});

// Get active rooms (public API)
app.get('/api/rooms/active', async (req, res) => {
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
      WHERE r.status = 'waiting' 
        AND r.expires_at > NOW()
      GROUP BY r.id, r.code, r.host_username, r.topic, r.difficulty, 
               r.status, r.current_players, r.max_players, r.created_at
      ORDER BY r.created_at DESC
      LIMIT 50
    `);
    
    res.json({
      success: true,
      rooms: result.rows
    });
  } catch (error) {
    console.error('Error fetching active rooms:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rooms' });
  }
});

// Socket.io setup
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['polling', 'websocket'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// Helper function to generate room code
function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Game state management
const gameStates = new Map();

io.on('connection', async (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Create a new room
  socket.on('create-room', async (username, callback) => {
    try {
      if (!username || username.trim().length < 2) {
        throw new Error('Username must be at least 2 characters');
      }
      
      const client = await pool.connect();
      try {
        // Generate unique room code
        let roomCode;
        let isUnique = false;
        
        while (!isUnique) {
          roomCode = generateRoomCode();
          const checkResult = await pool.query(
            'SELECT code FROM rooms WHERE code = $1',
            [roomCode]
          );
          isUnique = checkResult.rows.length === 0;
        }
        
        await client.query('BEGIN');
        
        // Create room
        const roomResult = await client.query(
          `INSERT INTO rooms (code, host_socket_id, host_username, current_players) 
           VALUES ($1, $2, $3, 1) 
           RETURNING id, code, host_username, topic, difficulty, status, current_players, max_players`,
          [roomCode, socket.id, username.trim()]
        );
        
        // Add host as player
        const playerResult = await client.query(
          `INSERT INTO players (room_id, username, socket_id, is_host) 
           VALUES ($1, $2, $3, true) 
           RETURNING id, username, score, is_ready, is_host, current_answer, has_answered`,
          [roomResult.rows[0].id, username.trim(), socket.id]
        );
        
        await client.query('COMMIT');
        
        // Join socket room
        socket.join(roomCode);
        
        // Store user data
        socket.userData = {
          playerId: playerResult.rows[0].id,
          username: username.trim(),
          roomCode: roomCode,
          isHost: true
        };
        
        // Initialize game state for this room
        gameStates.set(roomCode, {
          currentQuestion: 1,
          totalQuestions: 3,
          questionTimer: null,
          playersAnswered: new Set(),
          gameStarted: false,
          topic: null,
          difficulty: 'medium'
        });
        
        callback({
          success: true,
          roomCode: roomCode,
          playerId: playerResult.rows[0].id,
          isHost: true,
          players: [playerResult.rows[0]],
          room: roomResult.rows[0]
        });
        
        console.log(`✅ Room created: ${roomCode} by ${username}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Create room error:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  // Join existing room
  socket.on('join-room', async ({ roomCode, username }, callback) => {
    try {
      if (!username || username.trim().length < 2) {
        throw new Error('Username must be at least 2 characters');
      }
      
      if (!roomCode || roomCode.length !== 6) {
        throw new Error('Invalid room code');
      }
      
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        
        // Get room
        const roomResult = await client.query(
          `SELECT * FROM rooms 
           WHERE code = $1 AND status = 'waiting' AND expires_at > NOW()`,
          [roomCode.toUpperCase()]
        );
        
        if (roomResult.rows.length === 0) {
          throw new Error('Room not found, already started, or expired');
        }
        
        const room = roomResult.rows[0];
        
        // Check room capacity
        if (room.current_players >= room.max_players) {
          throw new Error('Room is full');
        }
        
        // Check if username exists in room
        const existingPlayer = await client.query(
          'SELECT username FROM players WHERE room_id = $1 AND username = $2',
          [room.id, username.trim()]
        );
        
        if (existingPlayer.rows.length > 0) {
          throw new Error('Username already taken in this room');
        }
        
        // Add player
        const playerResult = await client.query(
          `INSERT INTO players (room_id, username, socket_id, is_host) 
           VALUES ($1, $2, $3, false) 
           RETURNING id, username, score, is_ready, is_host, current_answer, has_answered`,
          [room.id, username.trim(), socket.id]
        );
        
        // Update room player count
        await client.query(
          'UPDATE rooms SET current_players = current_players + 1 WHERE id = $1',
          [room.id]
        );
        
        // Get all players in room
        const playersResult = await client.query(
          `SELECT id, username, score, is_ready, is_host, current_answer, has_answered 
           FROM players 
           WHERE room_id = $1 
           ORDER BY joined_at`,
          [room.id]
        );
        
        await client.query('COMMIT');
        
        // Join socket room
        socket.join(room.code);
        
        // Store user data
        socket.userData = {
          playerId: playerResult.rows[0].id,
          username: username.trim(),
          roomCode: room.code,
          isHost: false
        };
        
        // Notify the joiner
        callback({
          success: true,
          roomCode: room.code,
          playerId: playerResult.rows[0].id,
          isHost: false,
          players: playersResult.rows,
          room: {
            ...room,
            current_players: room.current_players + 1
          }
        });
        
        // Notify others in the room
        socket.to(room.code).emit('player-joined', {
          username: username.trim(),
          players: playersResult.rows,
          room: {
            code: room.code,
            currentPlayers: room.current_players + 1,
            maxPlayers: room.max_players
          }
        });
        
        console.log(`✅ ${username} joined room: ${roomCode}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Join room error:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  // Start game (host only)
  socket.on('start-game', async ({ topic, difficulty }, callback) => {
    try {
      if (!socket.userData || !socket.userData.roomCode || !socket.userData.isHost) {
        throw new Error('Only host can start the game');
      }
      
      const { roomCode } = socket.userData;
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Update room status and game info
        const roomResult = await client.query(
          `UPDATE rooms 
           SET status = 'active', topic = $1, difficulty = $2, game_started_at = NOW() 
           WHERE code = $3 
           RETURNING *`,
          [topic, difficulty, roomCode]
        );
        
        // Get all players
        const playersResult = await client.query(
          `SELECT id, username, score, is_host 
           FROM players WHERE room_id = $1`,
          [roomResult.rows[0].id]
        );
        
        // Generate questions using OpenAI (simplified for now)
        const questions = generateSampleQuestions(topic, difficulty, 3);
        
        // Save questions to database
        for (let i = 0; i < questions.length; i++) {
          await client.query(
            `INSERT INTO questions (room_id, question_text, options, correct_index, round_number, topic, difficulty) 
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              roomResult.rows[0].id,
              questions[i].question,
              JSON.stringify(questions[i].options),
              questions[i].correctIndex,
              i + 1,
              topic,
              difficulty
            ]
          );
        }
        
        await client.query('COMMIT');
        
        // Update game state
        const gameState = gameStates.get(roomCode) || {};
        gameState.gameStarted = true;
        gameState.topic = topic;
        gameState.difficulty = difficulty;
        gameStates.set(roomCode, gameState);
        
        // Get first question
        const questionResult = await pool.query(
          `SELECT * FROM questions WHERE room_id = $1 AND round_number = 1`,
          [roomResult.rows[0].id]
        );
        
        // Send game started event to all players
        io.to(roomCode).emit('game-started', {
          topic: topic,
          difficulty: difficulty,
          totalQuestions: 3,
          currentQuestion: 1,
          players: playersResult.rows.map(p => ({
            ...p,
            currentAnswer: -1,
            hasAnswered: false
          }))
        });
        
        // Send first question
        if (questionResult.rows.length > 0) {
          const question = questionResult.rows[0];
          io.to(roomCode).emit('new-question', {
            id: question.id,
            question: question.question_text,
            options: question.options,
            round: 1,
            totalQuestions: 3,
            timeLimit: 20
          });
          
          // Start timer for this question
          startQuestionTimer(roomCode, 1);
        }
        
        callback({
          success: true,
          message: 'Game started successfully'
        });
        
        console.log(`🎮 Game started in room: ${roomCode}, Topic: ${topic}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Start game error:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  // Player submits answer
  socket.on('submit-answer', async ({ questionId, answerIndex, responseTime }, callback) => {
    try {
      if (!socket.userData || !socket.userData.roomCode || !socket.userData.playerId) {
        throw new Error('Player not properly joined');
      }
      
      const { roomCode, playerId } = socket.userData;
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Get question
        const questionResult = await client.query(
          `SELECT * FROM questions WHERE id = $1`,
          [questionId]
        );
        
        if (questionResult.rows.length === 0) {
          throw new Error('Question not found');
        }
        
        const question = questionResult.rows[0];
        const isCorrect = answerIndex === question.correct_index;
        
        // Save answer
        await client.query(
          `INSERT INTO answers (player_id, question_id, selected_index, is_correct, response_time) 
           VALUES ($1, $2, $3, $4, $5)`,
          [playerId, questionId, answerIndex, isCorrect, responseTime]
        );
        
        // Update player score if correct
        if (isCorrect) {
          await client.query(
            `UPDATE players SET score = score + 10 WHERE id = $1`,
            [playerId]
          );
        }
        
        // Mark player as answered for this question
        await client.query(
          `UPDATE players SET current_answer = $1, has_answered = true WHERE id = $2`,
          [answerIndex, playerId]
        );
        
        // Get updated player info
        const playerResult = await client.query(
          `SELECT username, score FROM players WHERE id = $1`,
          [playerId]
        );
        
        // Get room scores
        const scoresResult = await client.query(
          `SELECT p.username, p.score, p.has_answered 
           FROM players p 
           JOIN rooms r ON p.room_id = r.id 
           WHERE r.code = $1 
           ORDER BY p.score DESC`,
          [roomCode]
        );
        
        await client.query('COMMIT');
        
        // Update game state
        const gameState = gameStates.get(roomCode);
        if (gameState) {
          gameState.playersAnswered.add(playerId);
          
          // Check if all players have answered
          const totalPlayers = scoresResult.rows.length;
          const answeredPlayers = scoresResult.rows.filter(p => p.has_answered).length;
          
          if (answeredPlayers === totalPlayers) {
            // All players answered, move to next question
            setTimeout(() => {
              moveToNextQuestion(roomCode, question.round_number);
            }, 2000); // 2 second delay to show results
          }
        }
        
        // Send feedback to player
        callback({
          success: true,
          isCorrect: isCorrect,
          correctAnswer: question.correct_index,
          playerScore: playerResult.rows[0].score,
          responseTime: responseTime
        });
        
        // Update scores for all players
        io.to(roomCode).emit('score-update', {
          scores: scoresResult.rows.map(p => ({
            username: p.username,
            score: p.score,
            hasAnswered: p.has_answered
          }))
        });
        
        console.log(`📝 Answer submitted by ${socket.userData.username} in room ${roomCode}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Submit answer error:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  // Host starts next round
  socket.on('start-next-round', async ({ topic, difficulty }, callback) => {
    try {
      if (!socket.userData || !socket.userData.roomCode || !socket.userData.isHost) {
        throw new Error('Only host can start next round');
      }
      
      const { roomCode } = socket.userData;
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');
        
        // Reset player answers for new round
        await client.query(
          `UPDATE players 
           SET current_answer = -1, has_answered = false 
           WHERE room_id = (SELECT id FROM rooms WHERE code = $1)`,
          [roomCode]
        );
        
        // Delete old questions
        await client.query(
          `DELETE FROM questions 
           WHERE room_id = (SELECT id FROM rooms WHERE code = $1)`,
          [roomCode]
        );
        
        // Update room for new round
        const roomResult = await client.query(
          `UPDATE rooms 
           SET topic = $1, difficulty = $2, current_question = 1, 
               game_round = game_round + 1, game_started_at = NOW() 
           WHERE code = $3 
           RETURNING *`,
          [topic, difficulty, roomCode]
        );
        
        // Generate new questions
        const questions = generateSampleQuestions(topic, difficulty, 3);
        
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
              difficulty
            ]
          );
        }
        
        await client.query('COMMIT');
        
        // Reset game state
        const gameState = gameStates.get(roomCode);
        if (gameState) {
          gameState.currentQuestion = 1;
          gameState.playersAnswered.clear();
          gameState.topic = topic;
          gameState.difficulty = difficulty;
        }
        
        // Get first question of new round
        const questionResult = await pool.query(
          `SELECT q.* FROM questions q 
           JOIN rooms r ON q.room_id = r.id 
           WHERE r.code = $1 AND q.round_number = 1`,
          [roomCode]
        );
        
        if (questionResult.rows.length > 0) {
          const question = questionResult.rows[0];
          
          // Notify all players about new round
          io.to(roomCode).emit('next-round-started', {
            topic: topic,
            difficulty: difficulty,
            round: roomResult.rows[0].game_round,
            totalQuestions: 3
          });
          
          // Send first question after delay
          setTimeout(() => {
            io.to(roomCode).emit('new-question', {
              id: question.id,
              question: question.question_text,
              options: question.options,
              round: 1,
              totalQuestions: 3,
              timeLimit: 20
            });
            
            // Start timer
            startQuestionTimer(roomCode, 1);
          }, 3000); // 3 second delay before starting new round
        
          callback({
            success: true,
            message: 'Next round started successfully'
          });
        }
        
        console.log(`🔄 Next round started in room: ${roomCode}, Topic: ${topic}`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Start next round error:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  // Player leaves room
  socket.on('leave-room', async () => {
    try {
      if (socket.userData && socket.userData.roomCode) {
        const { roomCode, username } = socket.userData;
        
        // Remove player from database
        await pool.query(
          'DELETE FROM players WHERE socket_id = $1',
          [socket.id]
        );
        
        // Update room player count
        await pool.query(
          `UPDATE rooms 
           SET current_players = current_players - 1 
           WHERE code = $1 AND current_players > 0`,
          [roomCode]
        );
        
        // Notify others
        socket.to(roomCode).emit('player-left', {
          username: username,
          message: `${username} left the room`
        });
        
        socket.leave(roomCode);
        
        console.log(`👋 ${username} left room: ${roomCode}`);
      }
    } catch (error) {
      console.error('Leave room error:', error);
    }
  });
  
  // Get active rooms
  socket.on('get-active-rooms', async (callback) => {
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
        WHERE r.status = 'waiting' 
          AND r.expires_at > NOW()
        GROUP BY r.id, r.code, r.host_username, r.topic, r.difficulty, 
                 r.status, r.current_players, r.max_players, r.created_at
        ORDER BY r.created_at DESC
        LIMIT 50
      `);
      
      callback({
        success: true,
        rooms: result.rows
      });
    } catch (error) {
      console.error('Get active rooms error:', error);
      callback({
        success: false,
        error: error.message
      });
    }
  });
  
  // Handle disconnection
  socket.on('disconnect', async () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
    
    try {
      if (socket.userData && socket.userData.roomCode) {
        const { roomCode, username } = socket.userData;
        
        // Remove player from database
        await pool.query(
          'DELETE FROM players WHERE socket_id = $1',
          [socket.id]
        );
        
        // Update room player count
        await pool.query(
          `UPDATE rooms 
           SET current_players = current_players - 1 
           WHERE code = $1 AND current_players > 0`,
          [roomCode]
        );
        
        // Notify others
        socket.to(roomCode).emit('player-disconnected', {
          username: username,
          message: `${username} disconnected`
        });
        
        // Check if room is empty and delete it
        const roomResult = await pool.query(
          'SELECT current_players FROM rooms WHERE code = $1',
          [roomCode]
        );
        
        if (roomResult.rows.length > 0 && roomResult.rows[0].current_players === 0) {
          await pool.query('DELETE FROM rooms WHERE code = $1', [roomCode]);
          gameStates.delete(roomCode);
          console.log(`🗑️ Deleted empty room: ${roomCode}`);
        }
      }
    } catch (error) {
      console.error('Disconnect cleanup error:', error);
    }
  });
  
  // Helper function to start question timer
  function startQuestionTimer(roomCode, questionNumber) {
    const gameState = gameStates.get(roomCode);
    if (!gameState) return;
    
    // Clear existing timer
    if (gameState.questionTimer) {
      clearTimeout(gameState.questionTimer);
    }
    
    // Set new timer (20 seconds)
    gameState.questionTimer = setTimeout(async () => {
      // Time's up for this question
      const roomResult = await pool.query(
        'SELECT id FROM rooms WHERE code = $1',
        [roomCode]
      );
      
      if (roomResult.rows.length > 0) {
        const questionResult = await pool.query(
          `SELECT * FROM questions 
           WHERE room_id = $1 AND round_number = $2`,
          [roomResult.rows[0].id, questionNumber]
        );
        
        if (questionResult.rows.length > 0) {
          // Mark unanswered players
          await pool.query(
            `UPDATE players SET has_answered = true WHERE room_id = $1 AND has_answered = false`,
            [roomResult.rows[0].id]
          );
          
          // Show correct answer to all
          io.to(roomCode).emit('time-up', {
            questionNumber: questionNumber,
            correctAnswer: questionResult.rows[0].correct_index
          });
          
          // Move to next question after delay
          setTimeout(() => {
            moveToNextQuestion(roomCode, questionNumber);
          }, 3000);
        }
      }
    }, 20000); // 20 seconds
  }
  
  // Helper function to move to next question
  async function moveToNextQuestion(roomCode, currentQuestionNumber) {
    const gameState = gameStates.get(roomCode);
    if (!gameState) return;
    
    const nextQuestionNumber = currentQuestionNumber + 1;
    
    // Check if there are more questions
    const roomResult = await pool.query(
      'SELECT id, total_questions FROM rooms WHERE code = $1',
      [roomCode]
    );
    
    if (roomResult.rows.length === 0) return;
    
    const room = roomResult.rows[0];
    
    if (nextQuestionNumber <= room.total_questions) {
      // More questions remain
      const questionResult = await pool.query(
        `SELECT * FROM questions 
         WHERE room_id = $1 AND round_number = $2`,
        [room.id, nextQuestionNumber]
      );
      
      if (questionResult.rows.length > 0) {
        const question = questionResult.rows[0];
        
        // Reset player answers for next question
        await pool.query(
          `UPDATE players 
           SET current_answer = -1, has_answered = false 
           WHERE room_id = $1`,
          [room.id]
        );
        
        // Update game state
        gameState.currentQuestion = nextQuestionNumber;
        gameState.playersAnswered.clear();
        
        // Update room
        await pool.query(
          'UPDATE rooms SET current_question = $1 WHERE id = $2',
          [nextQuestionNumber, room.id]
        );
        
        // Send next question
        io.to(roomCode).emit('new-question', {
          id: question.id,
          question: question.question_text,
          options: question.options,
          round: nextQuestionNumber,
          totalQuestions: room.total_questions,
          timeLimit: 20
        });
        
        // Start timer for next question
        startQuestionTimer(roomCode, nextQuestionNumber);
      }
    } else {
      // All questions completed
      await pool.query(
        'UPDATE rooms SET status = $1 WHERE id = $2',
        ['completed', room.id]
      );
      
      // Get final scores
      const scoresResult = await pool.query(
        `SELECT username, score 
         FROM players WHERE room_id = $1 
         ORDER BY score DESC`,
        [room.id]
      );
      
      // Send game completed event
      io.to(roomCode).emit('game-completed', {
        leaderboard: scoresResult.rows,
        round: gameState.round || 1
      });
      
      // Reset game state for potential next round
      gameState.gameStarted = false;
      gameState.currentQuestion = 1;
      gameState.playersAnswered.clear();
    }
  }
});

// Helper function to generate sample questions (replace with OpenAI API)
function generateSampleQuestions(topic, difficulty, count) {
  const questions = [];
  
  for (let i = 1; i <= count; i++) {
    let question, options, correctIndex;
    
    switch (topic.toLowerCase()) {
      case 'space exploration':
        if (i === 1) {
          question = 'What is the largest planet in our solar system?';
          options = ['Mercury', 'Venus', 'Earth', 'Jupiter'];
          correctIndex = 3;
        } else if (i === 2) {
          question = 'Which planet is known as the Red Planet?';
          options = ['Mars', 'Venus', 'Jupiter', 'Saturn'];
          correctIndex = 0;
        } else {
          question = 'What is the name of our galaxy?';
          options = ['Andromeda', 'Milky Way', 'Whirlpool', 'Sombrero'];
          correctIndex = 1;
        }
        break;
        
      case 'chemistry basics':
        if (i === 1) {
          question = 'What is the chemical symbol for water?';
          options = ['H2O', 'CO2', 'O2', 'NaCl'];
          correctIndex = 0;
        } else if (i === 2) {
          question = 'What is the atomic number of carbon?';
          options = ['6', '12', '14', '16'];
          correctIndex = 0;
        } else {
          question = 'Which element is the most abundant in the universe?';
          options = ['Oxygen', 'Carbon', 'Hydrogen', 'Helium'];
          correctIndex = 2;
        }
        break;
        
      case 'world war ii':
        if (i === 1) {
          question = 'In which year did World War II end?';
          options = ['1943', '1944', '1945', '1946'];
          correctIndex = 2;
        } else if (i === 2) {
          question = 'Which country was not part of the Axis Powers?';
          options = ['Germany', 'Japan', 'Italy', 'France'];
          correctIndex = 3;
        } else {
          question = 'Who was the Prime Minister of the UK during WWII?';
          options = ['Winston Churchill', 'Neville Chamberlain', 'Clement Attlee', 'Anthony Eden'];
          correctIndex = 0;
        }
        break;
        
      default:
        question = `Sample question ${i} about ${topic}`;
        options = ['Option A', 'Option B', 'Option C', 'Option D'];
        correctIndex = Math.floor(Math.random() * 4);
    }
    
    questions.push({
      question,
      options,
      correctIndex
    });
  }
  
  return questions;
}

// Start server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`
🚀 QuizSmash Backend Server
─────────────────────────────
✅ REST API:  http://localhost:${PORT}/api/health
🔌 Socket.IO: ws://localhost:${PORT}
📊 Database:  ${process.env.DB_NAME || 'quizsmash'}
─────────────────────────────
  `);
});