import { useState, useEffect } from "react";
import { useSocket } from "../contexts/SocketContext";
import type { GameState } from "../types/game";

export const useGameState = () => {
  const { socket } = useSocket();
  const [gameState, setGameState] = useState<GameState>({
    roomCode: "",
    playerId: "",
    username: "",
    isHost: false,
    players: [],
    currentQuestion: null,
    currentRound: 0,
    totalQuestions: 0,
    gameStatus: "lobby",
    scores: {},
  });

  useEffect(() => {
    if (!socket) return;

    const handlers = {
      "room-created": (data: any) => {
        setGameState((prev) => ({
          ...prev,
          roomCode: data.roomCode,
          playerId: data.playerId,
          isHost: data.isHost,
          gameStatus: "lobby",
        }));
      },

      "room-joined": (data: any) => {
        setGameState((prev) => ({
          ...prev,
          roomCode: data.roomCode,
          playerId: data.playerId,
          players: data.players,
          isHost: data.isHost,
          gameStatus: "lobby",
        }));
      },

      "player-joined": (data: any) => {
        setGameState((prev) => ({
          ...prev,
          players: data.players,
        }));
      },

      "game-started": (data: any) => {
        setGameState((prev) => ({
          ...prev,
          gameStatus: "playing",
          totalQuestions: data.totalQuestions,
          currentRound: 1,
          currentQuestion: {
            id: data.firstQuestion.id,
            question: data.firstQuestion.question,
            options: data.firstQuestion.options,
            correctIndex: -1, // Not revealed yet
            round: 1,
          },
          players: data.players,
        }));
      },

      "next-question": (data: any) => {
        setGameState((prev) => ({
          ...prev,
          currentRound: data.round,
          currentQuestion: {
            id: data.id,
            question: data.question,
            options: data.options,
            correctIndex: -1,
            round: data.round,
          },
        }));
      },

      "answer-feedback": (data: any) => {
        // Handle answer feedback
        console.log("Answer feedback:", data);
      },

      "score-update": (data: any) => {
        const scores: Record<string, number> = {};
        data.scores.forEach((player: any) => {
          scores[player.username] = player.score;
        });

        setGameState((prev) => ({
          ...prev,
          scores,
        }));
      },

      "game-completed": (data: any) => {
        setGameState((prev) => ({
          ...prev,
          gameStatus: "finished",
        }));
      },

      error: (data: any) => {
        alert(`Error: ${data.message}`);
      },
    };

    // Register all event handlers
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    return () => {
      // Clean up event listeners
      Object.keys(handlers).forEach((event) => {
        socket.off(event);
      });
    };
  }, [socket]);

  return { gameState, setGameState };
};
