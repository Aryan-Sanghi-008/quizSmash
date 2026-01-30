import React from "react";
import { SocketProvider, useSocket } from "./contexts/SocketContext";
import { useGameState } from "./hooks/useGameState";
import LandingPage from "./pages/LandingPage";
import RoomLobby from "./pages/RoomLobby";

const AppContent: React.FC = () => {
  const { gameState } = useGameState();
  const { socket } = useSocket();

  const handleStartGame = (topic: string, difficulty: string) => {
    socket?.emit("start-game", {
      roomCode: gameState.roomCode,
      topic,
      difficulty,
    });
  };

  const handleAnswerSelect = (answerIndex: number) => {
    socket?.emit("submit-answer", {
      roomCode: gameState.roomCode,
      playerId: gameState.playerId,
      questionId: gameState.currentQuestion?.id,
      answerIndex,
    });
  };

  const handleNextQuestion = () => {
    socket?.emit("next-question", {
      roomCode: gameState.roomCode,
      currentRound: gameState.currentRound,
    });
  };

  // Render based on game state
  if (!gameState.roomCode) {
    return <LandingPage />;
  }

  if (gameState.gameStatus === "lobby") {
    return (
      <RoomLobby
        roomCode={gameState.roomCode}
        players={gameState.players}
        isHost={gameState.isHost}
        onStartGame={handleStartGame}
      />
    );
  }

  // if (gameState.gameStatus === "playing") {
  //   return (
  //     <GameScreen
  //       gameState={gameState}
  //       onAnswerSelect={handleAnswerSelect}
  //       onNextQuestion={handleNextQuestion}
  //     />
  //   );
  // }

  if (gameState.gameStatus === "finished") {
    return (
      <div className="min-h-screen bg-linear-to-br from-primary-50 to-purple-50 p-4 flex items-center justify-center">
        <div className="card max-w-2xl w-full">
          <h1 className="text-3xl font-bold text-center text-gray-800 mb-6">
            Game Over!
          </h1>
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-700">
              Final Leaderboard
            </h2>
            {Object.entries(gameState.scores)
              .sort(([, a], [, b]) => b - a)
              .map(([username, score], index) => (
                <div
                  key={username}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                        index === 0
                          ? "bg-yellow-100 text-yellow-800"
                          : index === 1
                            ? "bg-gray-200 text-gray-700"
                            : index === 2
                              ? "bg-orange-100 text-orange-800"
                              : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <span className="text-lg font-semibold">{username}</span>
                  </div>
                  <span className="text-xl font-bold text-primary-700">
                    {score} pts
                  </span>
                </div>
              ))}
            <button
              onClick={() => window.location.reload()}
              className="btn-primary w-full mt-8"
            >
              Play Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

const App: React.FC = () => {
  return (
    <SocketProvider>
      <AppContent />
    </SocketProvider>
  );
};

export default App;
