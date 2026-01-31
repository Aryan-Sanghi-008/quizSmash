import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useRoom } from "../contexts/RoomContext";
import { useSocket } from "../contexts/SocketContext";
import toast from "react-hot-toast";
import {
  Gamepad2,
  Users,
  Trophy,
  Clock,
  LogOut,
  Home,
  RefreshCw,
  Zap,
  Brain,
} from "lucide-react";
import QuestionDisplay from "./QuestionDisplay";
import ScoreBoard from "./ScoreBoard";

const GamePage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { roomState, setRoomState } = useRoom();
  const { socket, leaveRoom } = useSocket();

  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [scores, setScores] = useState<
    Array<{ username: string; score: number; hasAnswered?: boolean }>
  >([]);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!roomState.roomCode) {
      navigate("/");
      return;
    }

    // Check if we have reconnection data
    const reconnectionData = location.state;
    if (reconnectionData && reconnectionData.currentQuestion) {
      setCurrentQuestion(reconnectionData.currentQuestion);
      if (reconnectionData.timeLeft) {
        setTimeLeft(reconnectionData.timeLeft);
      }
      setIsLoading(false);
    }

    // Listen for new questions
    socket?.on("new-question", (data) => {
      setCurrentQuestion(data);
      setTimeLeft(data.timeLimit || 20);
      setIsLoading(false);
    });

    // Listen for score updates
    socket?.on("score-update", (data) => {
      setScores(data.scores);
    });

    // Listen for time-up event
    socket?.on("time-up", (data) => {
      toast("Time's up!", { icon: "⏰" });
    });

    // Listen for game completion
    socket?.on("game-completed", (data) => {
      setGameCompleted(true);
      setLeaderboard(data.leaderboard);
      setRoomState((prev) => ({ ...prev, status: "finished" }));
    });

    // Listen for player join/leave during game
    socket?.on("player-joined", (data) => {
      toast.success(`${data.username} joined the game!`, { icon: "👋" });
      setScores(
        data.players.map((p: any) => ({
          username: p.username,
          score: p.score,
          hasAnswered: p.hasAnswered,
        })),
      );
    });

    socket?.on("player-left", (data) => {
      toast(`${data.username} left the game`, { icon: "👋" });
    });

    // Request current game state if not already loaded
    if (!currentQuestion && !reconnectionData) {
      socket?.emit(
        "get-game-state",
        { roomCode: roomState.roomCode },
        (response: any) => {
          if (response.success) {
            setCurrentQuestion(response.currentQuestion);
            setScores(response.scores || []);
            if (response.timeLeft) {
              setTimeLeft(response.timeLeft);
            }
          }
          setIsLoading(false);
        },
      );
    }

    return () => {
      socket?.off("new-question");
      socket?.off("score-update");
      socket?.off("time-up");
      socket?.off("game-completed");
      socket?.off("player-joined");
      socket?.off("player-left");
    };
  }, [socket, roomState.roomCode, navigate, location.state, currentQuestion]);

  const handleAnswerSelect = (answerIndex: number, responseTime: number) => {
    if (!currentQuestion) return;

    socket?.emit(
      "submit-answer",
      {
        questionId: currentQuestion.id,
        answerIndex,
        responseTime,
      },
      (response: any) => {
        if (response.success) {
          if (response.isCorrect) {
            toast.success(`Correct! +10 points`, { icon: "🎉" });
          } else {
            toast.error("Incorrect", { icon: "❌" });
          }
        }
      },
    );
  };

  const handleLeaveGame = async () => {
    await leaveRoom();
    navigate("/");
  };

  const handlePlayAgain = () => {
    navigate("/lobby");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-6"></div>
          <p className="text-gray-600">Loading game...</p>
        </div>
      </div>
    );
  }

  if (gameCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-block p-4 bg-gradient-to-r from-primary-500 to-purple-500 rounded-2xl mb-6">
              <Trophy className="w-12 h-12 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-gray-800 mb-2">
              Game Over!
            </h1>
            <p className="text-gray-600">
              Topic: {roomState.topic} • Difficulty: {roomState.difficulty}
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-8 mb-8">
            <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">
              Final Leaderboard
            </h2>
            <div className="space-y-4">
              {leaderboard.map((player, index) => (
                <div
                  key={player.username}
                  className={`p-6 rounded-xl border-2 ${
                    index === 0
                      ? "border-yellow-400 bg-yellow-50"
                      : index === 1
                        ? "border-gray-300 bg-gray-50"
                        : index === 2
                          ? "border-amber-300 bg-amber-50"
                          : "border-gray-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div
                        className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-2xl ${
                          index === 0
                            ? "bg-yellow-100 text-yellow-800"
                            : index === 1
                              ? "bg-gray-200 text-gray-700"
                              : index === 2
                                ? "bg-amber-100 text-amber-800"
                                : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-xl">
                          {player.username}
                        </h3>
                        {player.username === roomState.username && (
                          <span className="text-sm text-primary-600 font-medium">
                            You
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-primary-700">
                        {player.score}
                        <span className="text-sm text-gray-500 ml-1">pts</span>
                      </div>
                      {index === 0 && (
                        <div className="text-sm text-yellow-600 font-medium mt-1">
                          🏆 Winner!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handlePlayAgain}
              className="px-8 py-4 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-bold hover:from-primary-600 hover:to-primary-700 transition-all shadow-lg flex items-center justify-center"
            >
              <RefreshCw className="w-5 h-5 mr-3" />
              Play Again
            </button>
            <button
              onClick={handleLeaveGame}
              className="px-8 py-4 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-xl font-bold hover:from-gray-600 hover:to-gray-700 transition-all shadow-lg flex items-center justify-center"
            >
              <Home className="w-5 h-5 mr-3" />
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50">
      {/* Game Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-r from-primary-500 to-purple-500 rounded-xl">
                <Gamepad2 className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">QuizSmash</h1>
                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span className="font-mono font-bold text-primary-700">
                    Room: {roomState.roomCode}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {roomState.players.length} players
                  </span>
                  {roomState.topic && (
                    <span className="flex items-center">
                      <Brain className="w-4 h-4 mr-1" />
                      {roomState.topic}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="px-4 py-2 bg-primary-50 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5 text-primary-600" />
                  <span className="font-bold text-primary-700">
                    {roomState.difficulty}
                  </span>
                </div>
              </div>

              <button
                onClick={handleLeaveGame}
                className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium hover:bg-red-200 transition-colors flex items-center"
              >
                <LogOut className="w-5 h-5 mr-2" />
                Leave Game
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Game Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Question */}
          <div className="lg:col-span-2">
            {currentQuestion ? (
              <QuestionDisplay
                question={{
                  id: currentQuestion.id,
                  question: currentQuestion.question,
                  options: currentQuestion.options,
                  correctIndex: -1,
                  round: currentQuestion.round,
                  topic: roomState.topic ?? "",
                  difficulty: roomState.difficulty ?? "easy",
                }}
                onAnswerSelect={handleAnswerSelect}
                timeLimit={timeLeft}
                currentRound={1}
                totalRounds={1}
              />
            ) : (
              <div className="text-center py-12">
                <div className="animate-pulse">
                  <Clock className="w-16 h-16 text-gray-400 mx-auto mb-6" />
                  <p className="text-gray-600">Waiting for next question...</p>
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Scoreboard */}
          <div className="lg:col-span-1">
            <ScoreBoard
              scores={scores.map((s) => ({
                id: s.username,
                username: s.username,
                score: s.score,
                isHost:
                  s.username ===
                  roomState.players.find((p) => p.isHost)?.username,
                hasAnswered: s.hasAnswered,
              }))}
              currentPlayer={roomState.username}
              currentQuestion={currentQuestion?.round || 1}
              totalQuestions={3}
            />

            {/* Game Info Panel */}
            <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4">Game Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span
                    className={`font-bold ${
                      roomState.status === "playing"
                        ? "text-green-600"
                        : "text-yellow-600"
                    }`}
                  >
                    {roomState.status === "playing"
                      ? "In Progress"
                      : "Starting..."}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Players Online</span>
                  <span className="font-bold text-primary-700">
                    {scores.length} / {roomState.players.length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Topic</span>
                  <span className="font-bold">
                    {roomState.topic || "Not set"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Difficulty</span>
                  <span className="font-bold">
                    {roomState.difficulty || "Medium"}
                  </span>
                </div>
              </div>

              {/* Join Instructions */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <span className="font-bold">Invite friends:</span> Share room
                  code{" "}
                  <code className="font-mono font-bold">
                    {roomState.roomCode}
                  </code>
                </p>
                <p className="text-xs text-blue-600 mt-2">
                  New players can join mid-game and answer current question!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamePage;
