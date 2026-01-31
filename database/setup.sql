-- Drop existing tables if needed
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
  status VARCHAR(20) DEFAULT 'waiting',
  max_players INTEGER DEFAULT 4,
  current_players INTEGER DEFAULT 1,
  current_question INTEGER DEFAULT 0,
  total_questions INTEGER DEFAULT 3,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
  settings JSONB DEFAULT '{"timePerQuestion": 20, "pointsPerQuestion": 10}'
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
  created_at TIMESTAMP DEFAULT NOW()
);

-- Create answers table
CREATE TABLE answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID REFERENCES players(id) ON DELETE CASCADE,
  question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
  selected_index INTEGER,
  is_correct BOOLEAN,
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

-- Insert sample data for testing
INSERT INTO rooms (code, host_username, topic, difficulty, status, current_players) VALUES
('ABC123', 'QuizMaster', 'Space Exploration', 'medium', 'waiting', 2),
('DEF456', 'ScienceGuru', 'Chemistry Basics', 'easy', 'waiting', 1),
('GHI789', 'HistoryBuff', 'World War II', 'hard', 'waiting', 3);

INSERT INTO players (room_id, username, socket_id, is_host) 
SELECT id, host_username, 'sample-socket-id', true FROM rooms;

-- Add more players to first room
INSERT INTO players (room_id, username, socket_id, is_host) 
SELECT id, 'SpaceFan', 'socket-2', false FROM rooms WHERE code = 'ABC123';

-- Add players to third room
INSERT INTO players (room_id, username, socket_id, is_host) 
SELECT id, 'HistoryLover', 'socket-3', false FROM rooms WHERE code = 'GHI789';

INSERT INTO players (room_id, username, socket_id, is_host) 
SELECT id, 'WarExpert', 'socket-4', false FROM rooms WHERE code = 'GHI789';