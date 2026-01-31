import React, { createContext, useContext, useState, useEffect } from 'react';

interface Player {
  id: string;
  username: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
  currentAnswer?: number;
  hasAnswered?: boolean;
}

interface RoomState {
  roomCode: string;
  playerId: string;
  username: string;
  isHost: boolean;
  players: Player[];
  topic?: string;
  difficulty?: string;
  status: 'idle' | 'waiting' | 'playing' | 'finished';
  gameState?: {
    currentQuestion: number;
    totalQuestions: number;
    topic: string;
    difficulty: string;
    gameStarted: boolean;
  };
}

interface RoomContextType {
  roomState: RoomState;
  setRoomState: React.Dispatch<React.SetStateAction<RoomState>>;
  resetRoom: () => void;
  saveToLocalStorage: () => void;
  loadFromLocalStorage: () => RoomState | null;
  clearLocalStorage: () => void;
}

const RoomContext = createContext<RoomContextType>({
  roomState: {
    roomCode: '',
    playerId: '',
    username: '',
    isHost: false,
    players: [],
    status: 'idle',
  },
  setRoomState: () => {},
  resetRoom: () => {},
  saveToLocalStorage: () => {},
  loadFromLocalStorage: () => null,
  clearLocalStorage: () => {},
});

export const useRoom = () => useContext(RoomContext);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [roomState, setRoomState] = useState<RoomState>({
    roomCode: '',
    playerId: '',
    username: '',
    isHost: false,
    players: [],
    status: 'idle',
  });

  const saveToLocalStorage = () => {
    if (roomState.roomCode && roomState.username) {
      localStorage.setItem('quizsmash_room', JSON.stringify({
        roomCode: roomState.roomCode,
        username: roomState.username,
        playerId: roomState.playerId,
        isHost: roomState.isHost,
        timestamp: Date.now()
      }));
    }
  };

  const loadFromLocalStorage = (): RoomState | null => {
    const saved = localStorage.getItem('quizsmash_room');
    if (!saved) return null;
    
    try {
      const data = JSON.parse(saved);
      const oneHourAgo = Date.now() - (60 * 60 * 1000);
      
      // Only restore if saved within last hour
      if (data.timestamp && data.timestamp > oneHourAgo) {
        return {
          roomCode: data.roomCode || '',
          playerId: data.playerId || '',
          username: data.username || '',
          isHost: data.isHost || false,
          players: [],
          status: 'idle',
        };
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    
    return null;
  };

  const clearLocalStorage = () => {
    localStorage.removeItem('quizsmash_room');
  };

  const resetRoom = () => {
    setRoomState({
      roomCode: '',
      playerId: '',
      username: '',
      isHost: false,
      players: [],
      status: 'idle',
    });
    clearLocalStorage();
  };

  // Auto-save to localStorage when room state changes
  useEffect(() => {
    saveToLocalStorage();
  }, [roomState.roomCode, roomState.username, roomState.playerId, roomState.isHost]);

  return (
    <RoomContext.Provider value={{
      roomState,
      setRoomState,
      resetRoom,
      saveToLocalStorage,
      loadFromLocalStorage,
      clearLocalStorage,
    }}>
      {children}
    </RoomContext.Provider>
  );
};