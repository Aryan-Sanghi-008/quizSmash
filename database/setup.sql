-- setup.sql
\c quizsmash

-- Drop existing tables if they exist
DROP TABLE IF EXISTS answers CASCADE;
DROP TABLE IF EXISTS questions CASCADE;
DROP TABLE IF EXISTS players CASCADE;
DROP TABLE IF EXISTS rooms CASCADE;

-- Create rooms table
CREATE TABLE rooms (
    id SERIAL PRIMARY KEY,
    code VARCHAR(10) UNIQUE NOT NULL,
    host_socket_id VARCHAR(255),
    host_username VARCHAR(50),
    topic VARCHAR(255),
    difficulty VARCHAR(20),
    status VARCHAR(20) DEFAULT 'waiting',
    current_players INTEGER DEFAULT 0,
    max_players INTEGER DEFAULT 4,
    current_question INTEGER DEFAULT 1,
    total_questions INTEGER DEFAULT 3,
    game_round INTEGER DEFAULT 1,
    game_started_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours',
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    username VARCHAR(50) NOT NULL,
    socket_id VARCHAR(255),
    score INTEGER DEFAULT 0,
    is_host BOOLEAN DEFAULT FALSE,
    is_ready BOOLEAN DEFAULT FALSE,
    current_answer INTEGER DEFAULT -1,
    has_answered BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_username_per_room UNIQUE(room_id, username)
);

-- Create questions table
CREATE TABLE questions (
    id SERIAL PRIMARY KEY,
    room_id INTEGER REFERENCES rooms(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    options JSONB NOT NULL,
    correct_index INTEGER NOT NULL CHECK (correct_index >= 0 AND correct_index <= 3),
    round_number INTEGER DEFAULT 1,
    topic VARCHAR(255),
    difficulty VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Create answers table
CREATE TABLE answers (
    id SERIAL PRIMARY KEY,
    player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    selected_index INTEGER NOT NULL CHECK (selected_index >= 0 AND selected_index <= 3),
    is_correct BOOLEAN NOT NULL,
    response_time INTEGER,
    answered_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_rooms_code ON rooms(code);
CREATE INDEX idx_players_room_id ON players(room_id);
CREATE INDEX idx_players_socket_id ON players(socket_id);
CREATE INDEX idx_questions_room_id ON questions(room_id);
CREATE INDEX idx_answers_player_id ON answers(player_id);
CREATE INDEX idx_answers_question_id ON answers(question_id);