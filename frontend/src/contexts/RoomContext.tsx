import React, { createContext, useContext, useState } from "react";

interface Player {
  id: string;
  username: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
}

interface RoomState {
  roomCode: string;
  playerId: string;
  username: string;
  isHost: boolean;
  players: Player[];
  topic?: string;
  difficulty?: string;
  status: "idle" | "waiting" | "playing" | "finished";
}

interface RoomContextType {
  roomState: RoomState;
  setRoomState: React.Dispatch<React.SetStateAction<RoomState>>;
  resetRoom: () => void;
}

const RoomContext = createContext<RoomContextType>({
  roomState: {
    roomCode: "",
    playerId: "",
    username: "",
    isHost: false,
    players: [],
    status: "idle",
  },
  setRoomState: () => {},
  resetRoom: () => {},
});

export const useRoom = () => useContext(RoomContext);

export const RoomProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [roomState, setRoomState] = useState<RoomState>({
    roomCode: "",
    playerId: "",
    username: "",
    isHost: false,
    players: [],
    status: "idle",
  });

  const resetRoom = () => {
    setRoomState({
      roomCode: "",
      playerId: "",
      username: "",
      isHost: false,
      players: [],
      status: "idle",
    });
  };

  return (
    <RoomContext.Provider value={{ roomState, setRoomState, resetRoom }}>
      {children}
    </RoomContext.Provider>
  );
};
