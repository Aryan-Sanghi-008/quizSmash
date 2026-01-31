-- Clean up existing data (if any)
DROP TABLE IF EXISTS answers;
DROP TABLE IF EXISTS questions;
DROP TABLE IF EXISTS players;
DROP TABLE IF EXISTS rooms;

-- Create rooms table
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(6) UNIQUE NOT NULL,
  host_socket_id VARCHAR(100),
  host_username VARCHAR(50) NOT NULL,
  topic VARCHAR(100),
  difficulty VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'waiting', -- waiting, active, completed
  max_players INTEGER DEFAULT 4,
  current_players INTEGER DEFAULT 1,
  current_question INTEGER DEFAULT 1,
  total_questions INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  settings JSONB DEFAULT '{"timePerQuestion": 20, "pointsPerQuestion": 10, "minPlayers": 2}',
  game_round INTEGER DEFAULT 1,
  game_started_at TIMESTAMP
);

-- Create players table
CREATE TABLE players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  username VARCHAR(50) NOT NULL,
  socket_id VARCHAR(100) NOT NULL,
  score INTEGER DEFAULT 0,
  is_ready BOOLEAN DEFAULT false,
  is_host BOOLEAN DEFAULT false,
  joined_at TIMESTAMP DEFAULT NOW(),
  last_active TIMESTAMP DEFAULT NOW(),
  current_answer INTEGER DEFAULT -1,
  has_answered BOOLEAN DEFAULT false,
  UNIQUE(room_id, username)
);

-- Create questions table
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL,
  correct_index INTEGER NOT NULL,
  round_number INTEGER NOT NULL,
  topic VARCHAR(100),
  difficulty VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create answers table
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_index INTEGER,
  is_correct BOOLEAN,
  response_time DECIMAL(10,3), -- Time taken to answer in seconds
  answered_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_rooms_status ON rooms(status);
CREATE INDEX idx_rooms_expires ON rooms(expires_at);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_socket_id ON players(socket_id);
CREATE INDEX idx_questions_room_id ON questions(room_id);
CREATE INDEX idx_answers_player_id ON answers(player_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);

-- Insert 3 active rooms with 2 players each (ready to start)
INSERT INTO rooms (code, host_username, topic, difficulty, status, current_players, current_question, total_questions) VALUES
('QUIZAA', 'QuizMaster', 'Space Exploration', 'medium', 'waiting', 2, 1, 3),
('SMASHB', 'ScienceGuru', 'Chemistry Basics', 'easy', 'waiting', 2, 1, 3),
('TRIVIAC', 'HistoryBuff', 'World War II', 'hard', 'waiting', 3, 1, 3);

-- Insert players for each room
-- Room 1: QUIZAA (2 players)
INSERT INTO players (room_id, username, socket_id, is_host, score) 
SELECT id, 'QuizMaster', 'socket-host-1', true, 0 FROM rooms WHERE code = 'QUIZAA';

INSERT INTO players (room_id, username, socket_id, is_host, score) 
SELECT id, 'SpaceFan', 'socket-player-2', false, 0 FROM rooms WHERE code = 'QUIZAA';

-- Room 2: SMASHB (2 players)
INSERT INTO players (room_id, username, socket_id, is_host, score) 
SELECT id, 'ScienceGuru', 'socket-host-2', true, 0 FROM rooms WHERE code = 'SMASHB';

INSERT INTO players (room_id, username, socket_id, is_host, score) 
SELECT id, 'ChemistryLover', 'socket-player-3', false, 0 FROM rooms WHERE code = 'SMASHB';

-- Room 3: TRIVIAC (3 players)
INSERT INTO players (room_id, username, socket_id, is_host, score) 
SELECT id, 'HistoryBuff', 'socket-host-3', true, 0 FROM rooms WHERE code = 'TRIVIAC';

INSERT INTO players (room_id, username, socket_id, is_host, score) 
SELECT id, 'WarExpert', 'socket-player-4', false, 0 FROM rooms WHERE code = 'TRIVIAC';

INSERT INTO players (room_id, username, socket_id, is_host, score) 
SELECT id, 'AncientScholar', 'socket-player-5', false, 0 FROM rooms WHERE code = 'TRIVIAC';

-- Insert sample questions for room 1 (to show how questions would look)
INSERT INTO questions (room_id, question_text, options, correct_index, round_number, topic, difficulty) 
SELECT id, 
  'What is the largest planet in our solar system?',
  '["Mercury", "Venus", "Earth", "Jupiter"]'::jsonb,
  3,
  1,
  'Space Exploration',
  'medium'
FROM rooms WHERE code = 'QUIZAA';

INSERT INTO questions (room_id, question_text, options, correct_index, round_number, topic, difficulty) 
SELECT id, 
  'Which planet is known as the Red Planet?',
  '["Mars", "Venus", "Jupiter", "Saturn"]'::jsonb,
  0,
  2,
  'Space Exploration',
  'medium'
FROM rooms WHERE code = 'QUIZAA';

INSERT INTO questions (room_id, question_text, options, correct_index, round_number, topic, difficulty) 
SELECT id, 
  'What is the name of our galaxy?',
  '["Andromeda", "Milky Way", "Whirlpool", "Sombrero"]'::jsonb,
  1,
  3,
  'Space Exploration',
  'medium'
FROM rooms WHERE code = 'QUIZAA';