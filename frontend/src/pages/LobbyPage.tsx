import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useRoom } from "../contexts/RoomContext";
import { useSocket } from "../contexts/SocketContext";
import toast from "react-hot-toast";
import {
  Users,
  Copy,
  Check,
  Gamepad2,
  Volume2,
  VolumeX,
  Clock,
  Trophy,
  Send,
  Crown,
} from "lucide-react";

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomState, setRoomState } = useRoom();
  const { socket, leaveRoom } = useSocket();

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{ username: string; message: string; time: string }>
  >([]);

  useEffect(() => {
    if (!roomState.roomCode) {
      navigate("/");
      return;
    }

    // Listen for player join events
    socket?.on("player-joined", (data) => {
      setRoomState((prev) => ({
        ...prev,
        players: data.players,
      }));
    });

    // Listen for player leave events
    socket?.on("player-left", (data) => {
      toast(data.message);
    });

    // Listen for game start
    socket?.on("game-started", (data) => {
      setRoomState((prev) => ({
        ...prev,
        status: "playing",
        topic: data.topic,
        difficulty: data.difficulty,
      }));
      navigate("/game");
    });

    return () => {
      socket?.off("player-joined");
      socket?.off("player-left");
      socket?.off("game-started");
    };
  }, [socket, roomState.roomCode, navigate, setRoomState]);

  const handleStartGame = () => {
    if (!topic.trim()) {
      toast.error("Please enter a quiz topic");
      return;
    }

    if (roomState.players.length < 2) {
      toast.error("Need at least 2 players to start");
      return;
    }

    setIsStarting(true);

    // Emit start game event
    socket?.emit(
      "start-game",
      {
        roomCode: roomState.roomCode,
        topic: topic.trim(),
        difficulty,
      },
      (response: any) => {
        if (!response.success) {
          toast.error(response.error || "Failed to start game");
          setIsStarting(false);
        }
      },
    );
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    navigate("/");
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomState.roomCode);
    setCopied(true);
    toast.success("Room code copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const sendChatMessage = () => {
    if (!chatMessage.trim()) return;

    // Add message to chat
    setChatMessages((prev) => [
      ...prev,
      {
        username: roomState.username,
        message: chatMessage,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      },
    ]);

    // Emit chat message to others
    socket?.emit("chat-message", {
      roomCode: roomState.roomCode,
      message: chatMessage,
    });

    setChatMessage("");
  };

  if (!roomState.roomCode) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 via-white to-secondary-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-xl">
              <Gamepad2 className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text">QuizSmash</h1>
              <p className="text-gray-600">Waiting in lobby</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5 text-gray-600" />
              ) : (
                <Volume2 className="w-5 h-5 text-gray-600" />
              )}
            </button>
            <button
              onClick={handleLeaveRoom}
              className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Room Info & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Room Card */}
            <div className="glass-card rounded-2xl p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 mb-2">
                    Room #{roomState.roomCode}
                  </h2>
                  <div className="flex items-center space-x-4 text-gray-600">
                    <div className="flex items-center space-x-2">
                      <Users className="w-5 h-5" />
                      <span>{roomState.players.length}/4 players</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Clock className="w-5 h-5" />
                      <span>Waiting for host...</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={copyRoomCode}
                  className="flex items-center space-x-2 px-4 py-2 bg-primary-100 text-primary-700 rounded-lg font-medium hover:bg-primary-200 transition-colors"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
              </div>

              {/* Topic Input */}
              {roomState.isHost && (
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2">
                    Quiz Topic
                  </label>
                  <input
                    type="text"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    placeholder="Enter quiz topic (e.g., 'Space Exploration', 'Marvel Movies', 'World History')"
                    className="input-field"
                    disabled={!roomState.isHost}
                  />
                  <p className="text-sm text-gray-500 mt-2">
                    AI will generate questions based on this topic
                  </p>
                </div>
              )}

              {/* Difficulty Selection */}
              {roomState.isHost && (
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2">
                    Difficulty
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {["easy", "medium", "hard"].map((level) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`py-3 rounded-xl font-semibold transition-all ${
                          difficulty === level
                            ? "bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        disabled={!roomState.isHost}
                      >
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Game Button */}
              {roomState.isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={
                    isStarting || roomState.players.length < 2 || !topic.trim()
                  }
                  className="btn-primary w-full text-lg py-4"
                >
                  {isStarting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      Starting Game...
                    </div>
                  ) : (
                    "Start Game"
                  )}
                </button>
              ) : (
                <div className="text-center p-6 bg-gray-50 rounded-xl">
                  <div className="flex items-center justify-center space-x-3 mb-4">
                    <div className="animate-pulse-slow">
                      <Clock className="w-8 h-8 text-primary-500" />
                    </div>
                  </div>
                  <p className="text-gray-700 font-medium">
                    Waiting for host to start the game...
                  </p>
                  <p className="text-gray-500 text-sm mt-2">
                    Grab some snacks and get ready!
                  </p>
                </div>
              )}
            </div>

            {/* Players List */}
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Players ({roomState.players.length}/4)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roomState.players.map((player) => (
                  <div
                    key={player.id}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      player.isHost
                        ? "border-yellow-400 bg-yellow-50"
                        : "border-gray-200 bg-white hover:border-primary-300"
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center ${
                          player.isHost
                            ? "bg-gradient-to-r from-yellow-400 to-yellow-500"
                            : "bg-gradient-to-r from-primary-400 to-primary-500"
                        }`}
                      >
                        <span className="font-bold text-white text-lg">
                          {player.username.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-semibold text-gray-800">
                            {player.username}
                          </span>
                          {player.isHost && (
                            <Crown className="w-4 h-4 text-yellow-500" />
                          )}
                          {player.id === roomState.playerId && (
                            <span className="text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded">
                              You
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                          <div className="flex items-center space-x-1">
                            <Trophy className="w-4 h-4" />
                            <span>{player.score} pts</span>
                          </div>
                          {player.isReady && (
                            <span className="text-green-600 font-medium">
                              Ready ✓
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column - Chat */}
          <div className="lg:col-span-1">
            <div className="glass-card rounded-2xl p-6 h-full">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Lobby Chat
              </h2>

              {/* Chat Messages */}
              <div className="space-y-4 mb-4 h-[300px] overflow-y-auto">
                {chatMessages.map((msg, index) => (
                  <div key={index} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex justify-between items-start mb-1">
                      <span
                        className={`font-medium ${
                          msg.username === roomState.username
                            ? "text-primary-600"
                            : "text-gray-700"
                        }`}
                      >
                        {msg.username}
                      </span>
                      <span className="text-xs text-gray-500">{msg.time}</span>
                    </div>
                    <p className="text-gray-600">{msg.message}</p>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                  placeholder="Type a message..."
                  className="input-field flex-1"
                />
                <button
                  onClick={sendChatMessage}
                  disabled={!chatMessage.trim()}
                  className="px-4 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
