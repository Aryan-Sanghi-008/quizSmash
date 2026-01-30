import React, { useState } from "react";
import type { Player } from "../types/game";

interface RoomLobbyProps {
  roomCode: string;
  players: Player[];
  isHost: boolean;
  onStartGame: (topic: string, difficulty: string) => void;
}

const RoomLobby: React.FC<RoomLobbyProps> = ({
  roomCode,
  players,
  isHost,
  onStartGame,
}) => {
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [isStarting, setIsStarting] = useState(false);

  const handleStartGame = () => {
    if (!topic.trim()) {
      alert("Please enter a topic for the quiz");
      return;
    }
    setIsStarting(true);
    onStartGame(topic, difficulty);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert("Room code copied to clipboard!");
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-primary-700 mb-2">
            QuizSmash
          </h1>
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-gray-600">Room Code:</span>
              <div className="flex items-center space-x-2">
                <code className="text-2xl font-bold bg-white px-4 py-2 rounded-lg border-2 border-primary-500 tracking-widest">
                  {roomCode}
                </code>
                <button
                  onClick={copyRoomCode}
                  className="btn-secondary text-sm px-3 py-2"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Players List */}
          <div className="card">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">
              Players ({players.length}/4)
            </h2>
            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                      <span className="font-bold text-primary-700">
                        {player.username.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <span className="font-semibold text-gray-800">
                        {player.username}
                        {index === 0 && (
                          <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                            Host
                          </span>
                        )}
                      </span>
                      <div className="text-sm text-gray-500">
                        Score: {player.score}
                      </div>
                    </div>
                  </div>
                  {player.isReady && (
                    <span className="text-green-600 font-semibold text-sm">
                      Ready ✓
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Share Instructions */}
            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-800 mb-2">
                Share with friends:
              </h3>
              <p className="text-blue-600 text-sm">
                Share the room code <strong>{roomCode}</strong> with friends to
                join the game. Up to 4 players can join.
              </p>
            </div>
          </div>

          {/* Game Setup */}
          <div className="space-y-6">
            {/* Topic Input */}
            <div className="card">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Quiz Topic
              </h2>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter quiz topic (e.g., 'Space Exploration', 'World History', 'Marvel Movies')"
                className="input-field"
                disabled={!isHost}
              />
              <p className="text-sm text-gray-500 mt-2">
                AI will generate questions based on this topic
              </p>
            </div>

            {/* Difficulty Selection */}
            <div className="card">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Difficulty
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {["easy", "medium", "hard"].map((level) => (
                  <button
                    key={level}
                    onClick={() => setDifficulty(level)}
                    className={`py-3 rounded-lg font-semibold transition-all ${
                      difficulty === level
                        ? "bg-primary-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                    disabled={!isHost}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Start Game Button */}
            {isHost && (
              <button
                onClick={handleStartGame}
                disabled={isStarting || players.length < 1 || !topic.trim()}
                className="btn-primary w-full text-lg py-4"
              >
                {isStarting ? (
                  <div className="flex items-center justify-center">
                    <svg
                      className="animate-spin mr-3 h-6 w-6 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Generating Questions...
                  </div>
                ) : (
                  "Start Game"
                )}
              </button>
            )}

            {!isHost && (
              <div className="text-center p-4 bg-gray-100 rounded-lg">
                <p className="text-gray-700">
                  Waiting for host to start the game...
                </p>
                <div className="mt-4 flex justify-center">
                  <div className="animate-pulse-slow text-primary-600">
                    <svg
                      className="w-8 h-8"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomLobby;
