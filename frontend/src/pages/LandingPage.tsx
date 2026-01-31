import React, { useState, useEffect } from "react";
import { useSocket } from "../contexts/SocketContext";
import { useRoom } from "../contexts/RoomContext";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import {
  Users,
  Gamepad2,
  Sparkles,
  Zap,
  Globe,
  Clock,
  Trophy,
  Brain,
  Rocket,
  Copy,
  Check,
  RefreshCw,
  Wifi,
  WifiOff,
  AlertCircle,
} from "lucide-react";

const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { isConnected, createRoom, joinRoom, getActiveRooms, connect } =
    useSocket();
  const { setRoomState } = useRoom();

  const [activeTab, setActiveTab] = useState<"create" | "join">("create");
  const [username, setUsername] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [activeRooms, setActiveRooms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load active rooms when connected
  useEffect(() => {
    if (isConnected) {
      fetchActiveRooms();
    }
  }, [isConnected]);

  const fetchActiveRooms = async () => {
    if (!isConnected) {
      toast.error("Not connected to server");
      return;
    }

    setIsRefreshing(true);
    try {
      const response = await getActiveRooms();
      if (response.success) {
        setActiveRooms(response.rooms || []);
      } else {
        toast.error(response.error || "Failed to fetch rooms");
      }
    } catch (error: any) {
      console.error("Error fetching active rooms:", error);
      toast.error(error.error || "Connection error");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!username.trim()) {
      toast.error("Please enter a username");
      return;
    }

    if (username.trim().length < 2) {
      toast.error("Username must be at least 2 characters");
      return;
    }

    if (!isConnected) {
      toast.error("Not connected to server");
      return;
    }

    setIsLoading(true);
    try {
      const response = await createRoom(username.trim());

      if (response.success) {
        setRoomState({
          roomCode: response.roomCode,
          playerId: response.playerId,
          username: username.trim(),
          isHost: response.isHost,
          players: response.players,
          status: "waiting",
        });

        navigate("/lobby");
      } else {
        toast.error(response.error || "Failed to create room");
      }
    } catch (error: any) {
      console.error("Error creating room:", error);
      toast.error(error.error || "Failed to create room");
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (code?: string) => {
    const joinCode = code || roomCode;

    if (!username.trim()) {
      toast.error("Please enter a username");
      return;
    }

    if (!joinCode || joinCode.length !== 6) {
      toast.error("Please enter a valid 6-character room code");
      return;
    }

    if (!isConnected) {
      toast.error("Not connected to server");
      return;
    }

    setIsLoading(true);
    try {
      const response = await joinRoom(joinCode.toUpperCase(), username.trim());

      if (response.success) {
        setRoomState({
          roomCode: response.roomCode,
          playerId: response.playerId,
          username: username.trim(),
          isHost: response.isHost,
          players: response.players,
          status: "waiting",
        });

        navigate("/lobby");
      } else {
        toast.error(response.error || "Failed to join room");
      }
    } catch (error: any) {
      console.error("Error joining room:", error);
      toast.error(error.error || "Failed to join room");
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60),
    );

    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Connection Status Banner */}
      {!isConnected && (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <WifiOff className="w-5 h-5 mr-2" />
              <span className="font-medium">Disconnected from server</span>
            </div>
            <button
              onClick={connect}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Reconnect
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="py-6 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-linear-to-r from-blue-500 to-purple-500 rounded-xl">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-linear-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  QuizSmash
                </h1>
                <div className="flex items-center space-x-2">
                  <p className="text-gray-600 text-sm">
                    Real-time multiplayer quiz battles
                  </p>
                  {isConnected ? (
                    <div className="flex items-center text-green-600">
                      <Wifi className="w-4 h-4" />
                      <span className="text-xs ml-1">Online</span>
                    </div>
                  ) : (
                    <div className="flex items-center text-red-600">
                      <WifiOff className="w-4 h-4" />
                      <span className="text-xs ml-1">Offline</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
            <button
              onClick={fetchActiveRooms}
              disabled={isRefreshing || !isConnected}
              className="flex items-center space-x-2 px-4 py-2 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`}
              />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Left Column - Create/Join Forms */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <div className="flex space-x-4 mb-8">
                  <button
                    onClick={() => setActiveTab("create")}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      activeTab === "create"
                        ? "bg-linear-to-r from-blue-500 to-blue-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Create Room
                  </button>
                  <button
                    onClick={() => setActiveTab("join")}
                    className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                      activeTab === "join"
                        ? "bg-linear-to-r from-purple-500 to-purple-600 text-white shadow-lg"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    Join Room
                  </button>
                </div>

                {/* Username Input */}
                <div className="mb-6">
                  <label className="block text-gray-700 font-medium mb-2">
                    Your Username
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your display name"
                      className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                      maxLength={20}
                    />
                    <Users className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 mt-2">
                    This name will be visible to other players
                  </p>
                </div>

                {/* Create Room Form */}
                {activeTab === "create" && (
                  <div className="space-y-6">
                    <div className="p-4 bg-linear-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
                      <div className="flex items-start space-x-3">
                        <Sparkles className="w-6 h-6 text-blue-500 mt-1" />
                        <div>
                          <h3 className="font-semibold text-gray-800">
                            Quick Start
                          </h3>
                          <p className="text-gray-600 text-sm mt-1">
                            Create a room instantly and share the code with
                            friends. You'll be the host and can customize the
                            quiz.
                          </p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={handleCreateRoom}
                      disabled={isLoading || !username.trim() || !isConnected}
                      className="w-full bg-linear-to-r from-blue-500 to-blue-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-blue-600 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          Creating Room...
                        </>
                      ) : (
                        <>
                          <Rocket className="w-5 h-5 mr-3" />
                          Create New Room
                        </>
                      )}
                    </button>

                    {!isConnected && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <div className="flex items-center">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                          <span className="text-yellow-700">
                            Connect to server to create a room
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Join Room Form */}
                {activeTab === "join" && (
                  <div className="space-y-6">
                    <div className="mb-6">
                      <label className="block text-gray-700 font-medium mb-2">
                        Room Code
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={roomCode}
                          onChange={(e) =>
                            setRoomCode(e.target.value.toUpperCase())
                          }
                          placeholder="Enter 6-digit code"
                          className="w-full px-4 py-3 pl-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none uppercase tracking-widest"
                          maxLength={6}
                        />
                        <Globe className="absolute left-4 top-3.5 w-5 h-5 text-gray-400" />
                      </div>
                    </div>

                    <button
                      onClick={() => handleJoinRoom()}
                      disabled={
                        isLoading ||
                        !username.trim() ||
                        !roomCode.trim() ||
                        !isConnected
                      }
                      className="w-full bg-linear-to-r from-purple-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-xl hover:from-purple-600 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                          Joining Room...
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 mr-3" />
                          Join Room
                        </>
                      )}
                    </button>

                    {!isConnected && (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-xl">
                        <div className="flex items-center">
                          <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                          <span className="text-yellow-700">
                            Connect to server to join a room
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Features Section */}
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Brain className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800">AI-Powered</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Questions generated in real-time by advanced AI
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-purple-100 rounded-lg">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800">Real-time</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Live multiplayer with instant score updates
                  </p>
                </div>

                <div className="bg-white rounded-xl shadow p-6">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="p-2 bg-yellow-100 rounded-lg">
                      <Trophy className="w-6 h-6 text-yellow-600" />
                    </div>
                    <h3 className="font-semibold text-gray-800">Competitive</h3>
                  </div>
                  <p className="text-gray-600 text-sm">
                    Leaderboards and ranking system
                  </p>
                </div>
              </div>
            </div>

            {/* Right Column - Active Rooms List */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-gray-800">
                    Active Rooms
                  </h2>
                  <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                    {activeRooms.length} rooms
                  </span>
                </div>

                <div className="space-y-4 max-h-125 overflow-y-auto pr-2">
                  {!isConnected ? (
                    <div className="text-center py-8">
                      <WifiOff className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <p className="text-gray-500">
                        Connect to see active rooms
                      </p>
                    </div>
                  ) : activeRooms.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                        <Gamepad2 className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500">No active rooms yet</p>
                      <p className="text-gray-400 text-sm mt-2">
                        Be the first to create one!
                      </p>
                    </div>
                  ) : (
                    activeRooms.map((room) => (
                      <div
                        key={room.code}
                        className="bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 transition-colors"
                      >
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="flex items-center space-x-2 mb-1">
                              <span className="font-mono tracking-widest font-bold text-2xl text-blue-600">
                                {room.code}
                              </span>
                              <button
                                onClick={() => copyToClipboard(room.code)}
                                className="p-1 hover:bg-gray-100 rounded"
                              >
                                {copiedCode === room.code ? (
                                  <Check className="w-4 h-4 text-green-500" />
                                ) : (
                                  <Copy className="w-4 h-4 text-gray-400" />
                                )}
                              </button>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Users className="w-4 h-4" />
                              <span>
                                {room.current_players}/{room.max_players}{" "}
                                players
                              </span>
                              <span>•</span>
                              <span>{room.difficulty}</span>
                            </div>
                          </div>
                          <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-medium rounded">
                            {room.status}
                          </span>
                        </div>

                        {room.topic && (
                          <p className="text-gray-700 mb-3">
                            <span className="font-medium">Topic:</span>{" "}
                            {room.topic}
                          </p>
                        )}

                        <div className="flex justify-between items-center">
                          <div className="text-sm text-gray-500">
                            Host:{" "}
                            <span className="font-medium">
                              {room.host_username}
                            </span>
                          </div>
                          <div className="text-sm text-gray-500">
                            {formatTimeAgo(room.created_at)}
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setUsername((prev) => prev || "");
                            setRoomCode(room.code);
                            setActiveTab("join");
                          }}
                          className="w-full mt-4 py-2 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition-colors text-sm"
                        >
                          Join This Room
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LandingPage;
