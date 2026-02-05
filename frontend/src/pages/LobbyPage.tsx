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
  Settings,
  Bell,
  UserPlus,
  Sparkles,
  Rocket,
  Zap,
  Target,
  Globe,
  Shield,
  MessageSquare,
  Mic,
  MicOff,
} from "lucide-react";

const LobbyPage: React.FC = () => {
  const navigate = useNavigate();
  const { roomState, setRoomState } = useRoom();
  const { socket, isConnected, leaveRoom } = useSocket();

  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState("medium");
  const [isStarting, setIsStarting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isMicOn, setIsMicOn] = useState(false);
  const [chatMessage, setChatMessage] = useState("");
  const [chatMessages, setChatMessages] = useState<
    Array<{
      username: string;
      message: string;
      time: string;
      isSystem?: boolean;
    }>
  >([]);
  const [settings, setSettings] = useState({
    timePerQuestion: 20,
    pointsPerQuestion: 10,
    enableSound: true,
    showAnimations: true,
  });

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

      // Add system message
      setChatMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: `${data.username} joined the room!`,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSystem: true,
        },
      ]);

      toast.success(`${data.username} joined!`, {
        icon: "👋",
      });
    });

    // Listen for player leave events
    socket?.on("player-left", (data) => {
      setChatMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: `${data.username} left the room.`,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSystem: true,
        },
      ]);
      toast(`${data.message}`, { icon: "👋" });
    });

    // Listen for game start
    socket?.on("game-started", (data) => {
      setRoomState((prev) => ({
        ...prev,
        status: "playing",
        topic: data.topic,
        difficulty: data.difficulty,
      }));

      // Add game start message
      setChatMessages((prev) => [
        ...prev,
        {
          username: "System",
          message: `Game started! Topic: ${data.topic}, Difficulty: ${data.difficulty}`,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isSystem: true,
        },
      ]);

      navigate("/game");
    });

    // Listen for chat messages
    socket?.on("chat-message", (data) => {
      setChatMessages((prev) => [
        ...prev,
        {
          username: data.username,
          message: data.message,
          time: new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        },
      ]);
    });

    // Initial system message
    setChatMessages([
      {
        username: "System",
        message: `Welcome to room ${roomState.roomCode}!`,
        time: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isSystem: true,
      },
    ]);

    return () => {
      socket?.off("player-joined");
      socket?.off("player-left");
      socket?.off("game-started");
      socket?.off("chat-message");
    };
  }, [socket, roomState.roomCode, navigate, setRoomState]);

  const handleStartGame = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a quiz topic", { icon: "🎯" });
      return;
    }

    setIsStarting(true);

    try {
      socket?.emit(
        "start-game",
        { topic: topic.trim(), difficulty },
        (response: any) => {
          if (response.success) {
            toast.success("Game started! Loading questions...", {
              icon: "🚀",
              duration: 3000,
            });

            // Navigate after a brief delay to ensure server processed everything
            navigate(`/game/${roomState.roomCode}`);
          } else {
            toast.error(response.error || "Failed to start game", {
              icon: "❌",
            });
            setIsStarting(false);
          }
        },
      );
    } catch (error: any) {
      console.error("Start game error:", error);
      toast.error(error.message || "Failed to start game", {
        icon: "❌",
      });
      setIsStarting(false);
    }
  };

  const handleLeaveRoom = () => {
    leaveRoom();
    navigate("/");
    toast("Left the room", { icon: "👋" });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomState.roomCode);
    setCopied(true);
    toast.success("Room code copied to clipboard!", {
      icon: "📋",
    });
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

  const invitePlayers = () => {
    const inviteText = `Join my QuizSmash game! Room Code: ${roomState.roomCode}\n\nPlay at: ${window.location.origin}`;
    navigator.clipboard.writeText(inviteText);
    toast.success("Invite link copied to clipboard!", {
      icon: "📨",
    });
  };

  if (!roomState.roomCode) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-purple-50">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 25px 25px, #3b82f6 2px, transparent 0%)`,
            backgroundSize: "50px 50px",
          }}
        ></div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 relative">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4">
          <div className="flex items-center space-x-4">
            <div className="relative">
              <div className="p-4 bg-gradient-to-br from-primary-500 via-purple-500 to-pink-500 rounded-2xl shadow-xl">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-purple-600 bg-clip-text text-transparent">
                QuizSmash Lobby
              </h1>
              <p className="text-gray-600 flex items-center">
                <Globe className="w-4 h-4 mr-2" />
                Room #{roomState.roomCode} • {roomState.players.length}/4
                players
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Connection Status */}
            <div
              className={`px-4 py-2 rounded-lg flex items-center ${isConnected ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}
            >
              <div
                className={`w-2 h-2 rounded-full mr-2 ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`}
              ></div>
              <span className="font-medium">
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>

            {/* Audio Controls */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={`p-3 rounded-xl ${isMuted ? "bg-gray-200 text-gray-600" : "bg-primary-100 text-primary-600"}`}
            >
              {isMuted ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={() => setIsMicOn(!isMicOn)}
              className={`p-3 rounded-xl ${isMicOn ? "bg-green-100 text-green-600" : "bg-gray-200 text-gray-600"}`}
            >
              {isMicOn ? (
                <Mic className="w-5 h-5" />
              ) : (
                <MicOff className="w-5 h-5" />
              )}
            </button>

            <button
              onClick={handleLeaveRoom}
              className="px-5 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all shadow-lg hover:shadow-xl flex items-center"
            >
              <span>Leave Room</span>
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Room Info & Settings */}
          <div className="lg:col-span-2 space-y-6">
            {/* Main Room Card */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-8 border border-gray-200">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between mb-8 gap-6">
                <div className="flex-1">
                  <div className="flex items-center mb-3">
                    <Target className="w-6 h-6 text-primary-500 mr-3" />
                    <h2 className="text-2xl font-bold text-gray-800">
                      Room #{roomState.roomCode}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-gray-600">
                    <div className="flex items-center space-x-2 px-3 py-2 bg-blue-50 rounded-lg">
                      <Users className="w-5 h-5 text-blue-600" />
                      <span>{roomState.players.length}/4 players</span>
                    </div>

                    <div className="flex items-center space-x-2 px-3 py-2 bg-purple-50 rounded-lg">
                      <Shield className="w-5 h-5 text-purple-600" />
                      <span>{roomState.isHost ? "Host" : "Player"}</span>
                    </div>

                    <div className="flex items-center space-x-2 px-3 py-2 bg-amber-50 rounded-lg">
                      <Clock className="w-5 h-5 text-amber-600" />
                      <span>Waiting to start...</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={copyRoomCode}
                    className="px-5 py-3 bg-gradient-to-r from-primary-100 to-blue-100 text-primary-700 rounded-xl font-semibold hover:from-primary-200 hover:to-blue-200 transition-all flex items-center justify-center"
                  >
                    {copied ? (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-5 h-5 mr-2" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={invitePlayers}
                    className="px-5 py-3 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 rounded-xl font-semibold hover:from-green-200 hover:to-emerald-200 transition-all flex items-center justify-center"
                  >
                    <UserPlus className="w-5 h-5 mr-2" />
                    <span>Invite Players</span>
                  </button>
                </div>
              </div>

              {/* Topic Input */}
              {roomState.isHost && (
                <div className="mb-8">
                  <label className="block text-gray-700 font-semibold mb-3 flex items-center">
                    <Rocket className="w-5 h-5 mr-2 text-primary-500" />
                    Quiz Topic
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Enter quiz topic (e.g., 'Space Exploration', 'Marvel Movies', 'World History')"
                      className="w-full px-5 py-4 pl-12 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all text-lg placeholder-gray-400"
                      disabled={!roomState.isHost}
                    />
                    <Target className="absolute left-4 top-4 w-5 h-5 text-gray-400" />
                  </div>
                  <div className="mt-3 flex items-center text-gray-500">
                    <Sparkles className="w-4 h-4 mr-2" />
                    <span className="text-sm">
                      AI will generate questions based on this topic
                    </span>
                  </div>
                </div>
              )}

              {/* Difficulty Selection */}
              {roomState.isHost && (
                <div className="mb-8">
                  <label className="block text-gray-700 font-semibold mb-3 flex items-center">
                    <Zap className="w-5 h-5 mr-2 text-primary-500" />
                    Difficulty Level
                  </label>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      {
                        level: "easy",
                        color: "from-green-500 to-emerald-500",
                        icon: "😊",
                      },
                      {
                        level: "medium",
                        color: "from-yellow-500 to-amber-500",
                        icon: "😎",
                      },
                      {
                        level: "hard",
                        color: "from-red-500 to-rose-500",
                        icon: "🔥",
                      },
                    ].map(({ level, color, icon }) => (
                      <button
                        key={level}
                        onClick={() => setDifficulty(level)}
                        className={`py-4 rounded-xl font-semibold transition-all transform hover:scale-[1.02] ${
                          difficulty === level
                            ? `bg-gradient-to-r ${color} text-white shadow-xl`
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                        }`}
                        disabled={!roomState.isHost}
                      >
                        <div className="flex flex-col items-center">
                          <span className="text-2xl mb-2">{icon}</span>
                          <span>
                            {level.charAt(0).toUpperCase() + level.slice(1)}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Start Game Button */}
              {roomState.isHost ? (
                <button
                  onClick={handleStartGame}
                  disabled={isStarting || !topic.trim()} // Removed: || roomState.players.length < 2
                  className="w-full bg-gradient-to-r from-primary-500 via-purple-500 to-pink-500 text-white font-bold py-5 px-6 rounded-xl hover:from-primary-600 hover:via-purple-600 hover:to-pink-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-xl hover:shadow-2xl transform hover:-translate-y-1"
                >
                  {isStarting ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white mr-3"></div>
                      <span className="text-lg">Starting Game...</span>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center">
                      <Rocket className="w-6 h-6 mr-3" />
                      <span className="text-lg">Launch Game 🚀</span>
                    </div>
                  )}
                </button>
              ) : (
                <div className="text-center p-8 bg-gradient-to-r from-gray-50 to-blue-50 rounded-2xl border-2 border-gray-200">
                  <div className="flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-primary-500 to-primary-600 rounded-full flex items-center justify-center mb-6 animate-pulse">
                      <Clock className="w-10 h-10 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-800 mb-3">
                      Waiting for Host to Start
                    </h3>
                    <p className="text-gray-600 mb-6">
                      Grab some snacks and get ready! The game will start soon.
                    </p>
                    <div className="flex items-center space-x-2 text-gray-500">
                      <Bell className="w-5 h-5" />
                      <span>You'll be notified when the game starts</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Players List */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-8 border border-gray-200">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <Trophy className="w-6 h-6 text-primary-500 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-800">
                    Players ({roomState.players.length}/4)
                  </h2>
                </div>
                <div className="px-4 py-2 bg-primary-50 rounded-lg">
                  <span className="text-primary-700 font-semibold">
                    {roomState.players.filter((p) => p.isReady).length} Ready
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {roomState.players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`p-5 rounded-xl border-2 transition-all duration-300 hover:shadow-lg ${
                      player.isHost
                        ? "border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50"
                        : "border-gray-200 bg-white"
                    } ${player.id === roomState.playerId ? "ring-2 ring-primary-400" : ""}`}
                  >
                    <div className="flex items-center space-x-4">
                      {/* Player Avatar */}
                      <div
                        className={`relative w-14 h-14 rounded-full flex items-center justify-center ${
                          player.isHost
                            ? "bg-gradient-to-br from-yellow-400 to-amber-500"
                            : player.id === roomState.playerId
                              ? "bg-gradient-to-br from-primary-500 to-primary-600"
                              : "bg-gradient-to-br from-gray-400 to-gray-500"
                        }`}
                      >
                        <span className="font-bold text-white text-xl">
                          {player.username.charAt(0).toUpperCase()}
                        </span>
                        {player.isHost && (
                          <div className="absolute -top-1 -right-1">
                            <Crown className="w-5 h-5 text-yellow-500" />
                          </div>
                        )}
                      </div>

                      {/* Player Info */}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-3">
                            <span className="font-bold text-gray-800">
                              {player.username}
                            </span>
                            {player.id === roomState.playerId && (
                              <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
                                You
                              </span>
                            )}
                            {player.isHost &&
                              !(player.id === roomState.playerId) && (
                                <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                                  Host
                                </span>
                              )}
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-primary-700">
                              {player.score}
                              <span className="text-sm text-gray-500 ml-1">
                                pts
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Status Bar */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center">
                              {player.isReady ? (
                                <div className="flex items-center text-green-600 text-sm">
                                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                                  Ready
                                </div>
                              ) : (
                                <div className="flex items-center text-gray-500 text-sm">
                                  <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                                  Not Ready
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Rank Badge */}
                          <div
                            className={`px-3 py-1 rounded-full text-xs font-bold ${
                              index === 0
                                ? "bg-yellow-100 text-yellow-800"
                                : index === 1
                                  ? "bg-gray-100 text-gray-800"
                                  : index === 2
                                    ? "bg-amber-100 text-amber-800"
                                    : "bg-gray-100 text-gray-600"
                            }`}
                          >
                            #{index + 1}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Empty Slots */}
              {Array.from({ length: 4 - roomState.players.length }).map(
                (_, index) => (
                  <div
                    key={`empty-${index}`}
                    className="p-5 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 text-center"
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <UserPlus className="w-8 h-8 text-gray-400 mb-3" />
                      <p className="text-gray-500 font-medium">
                        Waiting for player...
                      </p>
                      <p className="text-gray-400 text-sm mt-1">
                        Slot #{roomState.players.length + index + 1}
                      </p>
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Right Column - Chat & Settings */}
          <div className="lg:col-span-1 space-y-6">
            {/* Chat Panel */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-200 h-full flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center">
                  <MessageSquare className="w-6 h-6 text-primary-500 mr-3" />
                  <h2 className="text-2xl font-bold text-gray-800">
                    Lobby Chat
                  </h2>
                </div>
                <div className="px-3 py-1 bg-primary-50 rounded-lg">
                  <span className="text-primary-700 text-sm font-medium">
                    {chatMessages.length} messages
                  </span>
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto mb-6 space-y-4 pr-2">
                {chatMessages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-xl ${
                      msg.isSystem
                        ? "bg-blue-50 border-l-4 border-blue-500"
                        : msg.username === roomState.username
                          ? "bg-gradient-to-r from-primary-50 to-blue-50 border border-primary-100"
                          : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center">
                        <span
                          className={`font-bold ${
                            msg.isSystem
                              ? "text-blue-700"
                              : msg.username === roomState.username
                                ? "text-primary-700"
                                : "text-gray-700"
                          }`}
                        >
                          {msg.username}
                        </span>
                        {msg.isSystem && (
                          <Settings className="w-4 h-4 text-blue-500 ml-2" />
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{msg.time}</span>
                    </div>
                    <p
                      className={`${
                        msg.isSystem ? "text-blue-600" : "text-gray-600"
                      }`}
                    >
                      {msg.message}
                    </p>
                  </div>
                ))}
              </div>

              {/* Chat Input */}
              <div className="flex space-x-3">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && sendChatMessage()}
                    placeholder="Type a message..."
                    className="w-full px-5 py-3 pl-12 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-primary-500 outline-none transition-all"
                  />
                  <MessageSquare className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                </div>
                <button
                  onClick={sendChatMessage}
                  disabled={!chatMessage.trim()}
                  className="px-5 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Quick Settings Panel */}
            <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-6 border border-gray-200">
              <div className="flex items-center mb-6">
                <Settings className="w-6 h-6 text-primary-500 mr-3" />
                <h2 className="text-xl font-bold text-gray-800">
                  Quick Settings
                </h2>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Sound Effects</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.enableSound}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          enableSound: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Animations</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showAnimations}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          showAnimations: e.target.checked,
                        }))
                      }
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                  </label>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <div className="mb-3">
                    <label className="block text-gray-700 mb-2">
                      Time per Question
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="10"
                        max="30"
                        step="5"
                        value={settings.timePerQuestion}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            timePerQuestion: parseInt(e.target.value),
                          }))
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="font-bold text-primary-700 min-w-[3rem]">
                        {settings.timePerQuestion}s
                      </span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-gray-700 mb-2">
                      Points per Question
                    </label>
                    <div className="flex items-center space-x-3">
                      <input
                        type="range"
                        min="5"
                        max="20"
                        step="5"
                        value={settings.pointsPerQuestion}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            pointsPerQuestion: parseInt(e.target.value),
                          }))
                        }
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                      <span className="font-bold text-primary-700 min-w-[3rem]">
                        {settings.pointsPerQuestion}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
