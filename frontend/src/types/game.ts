export interface Player {
  id: string;
  username: string;
  score: number;
  isReady: boolean;
}

export interface Question {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  round: number;
}

export interface Room {
  id: string;
  code: string;
  topic: string;
  difficulty: string;
  status: 'waiting' | 'active' | 'completed';
  playerCount: number;
}

export interface GameState {
  roomCode: string;
  playerId: string;
  username: string;
  isHost: boolean;
  players: Player[];
  currentQuestion: Question | null;
  currentRound: number;
  totalQuestions: number;
  gameStatus: 'lobby' | 'playing' | 'finished';
  scores: Record<string, number>;
}