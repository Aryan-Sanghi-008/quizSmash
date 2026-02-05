// GamePage.tsx - Updated with proper hook order
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
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
  // Hooks must be called in the same order every render
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { roomState, setRoomState } = useRoom();
  const { socket, leaveRoom } = useSocket();

  // All state declarations at the top
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number>(20);
  const [scores, setScores] = useState<
    Array<{ username: string; score: number; hasAnswered?: boolean }>
  >([]);
  const [gameCompleted, setGameCompleted] = useState(false);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [revealedAnswer, setRevealedAnswer] = useState<number | null>(null);

  // Helper function for reconnection
  const handleReconnection = useCallback(async () => {
    if (!roomCode) return;

    const savedUsername = localStorage.getItem('quizsmash_username');
    const savedPlayerId = localStorage.getItem('quizsmash_playerId');
    
    if (savedUsername && savedPlayerId && socket) {
      try {
        const response = await new Promise<any>((resolve) => {
          socket.emit("reconnect-room", {
            roomCode: roomCode.toUpperCase(),
            username: savedUsername
          }, resolve);
        });

        if (response.success) {
          setRoomState({
            roomCode: response.roomCode,
            playerId: response.playerId,
            username: savedUsername,
            isHost: response.isHost,
            players: response.players || [],
            status: response.room?.status || 'idle',
            topic: response.room?.topic,
            difficulty: response.room?.difficulty,
          });

          // Set current question if game is active
          if (response.currentQuestion) {
            setCurrentQuestion(response.currentQuestion);
            if (response.timeLeft) {
              setTimeLeft(response.timeLeft);
            }
          }

          setIsLoading(false);
        } else {
          navigate("/", { 
            state: { error: "Could not rejoin game. Please join from the landing page." }
          });
        }
      } catch (error) {
        console.error("Reconnection error:", error);
        navigate("/");
      }
    } else {
      navigate("/");
    }
  }, [roomCode, socket, navigate, setRoomState]);

  // Main effect - handle initial load and socket events
  useEffect(() => {
    if (!roomCode) {
      navigate("/");
      return;
    }

    // Handle reconnection on mount
    handleReconnection();

    // Socket event listeners
    const handleNewQuestion = (data: any) => {
      setCurrentQuestion(data);
      setTimeLeft(data.timeLimit || 20);
      setRevealedAnswer(null);
      setIsLoading(false);
    };

    const handleScoreUpdate = (data: any) => {
      setScores(data.scores);
    };

    const handleTimeUp = (data: any) => {
      toast("Time's up!", { icon: "⏰" });
    };

    const handleGameCompleted = (data: any) => {
      setGameCompleted(true);
      setLeaderboard(data.leaderboard || []);
      setRoomState(prev => ({ ...prev, status: "finished" }));
    };

    const handleRevealAnswer = (data: any) => {
      setRevealedAnswer(data.correctAnswer);
      toast(data.explanation || "The correct answer was revealed");
    };

    const handlePlayerJoined = (data: any) => {
      toast.success(`${data.username} joined the game!`, { icon: "👋" });
      setScores(
        data.players?.map((p: any) => ({
          username: p.username,
          score: p.score,
          hasAnswered: p.hasAnswered,
        })) || []
      );
    };

    const handlePlayerLeft = (data: any) => {
      toast(`${data.username} left the game`, { icon: "👋" });
    };

    // Add event listeners
    socket?.on("new-question", handleNewQuestion);
    socket?.on("score-update", handleScoreUpdate);
    socket?.on("time-up", handleTimeUp);
    socket?.on("game-completed", handleGameCompleted);
    socket?.on("reveal-answer", handleRevealAnswer);
    socket?.on("player-joined", handlePlayerJoined);
    socket?.on("player-left", handlePlayerLeft);

    // Request current game state
    if (socket && roomCode && !currentQuestion) {
      socket.emit(
        "get-game-state",
        { roomCode: roomCode.toUpperCase() },
        (response: any) => {
          if (response.success) {
            setCurrentQuestion(response.currentQuestion);
            setScores(response.scores || []);
            if (response.timeLeft) {
              setTimeLeft(response.timeLeft);
            }
          }
          setIsLoading(false);
        }
      );
    }

    // Timer effect for countdown
        let timer: ReturnType<typeof setInterval> | undefined;
        if (currentQuestion && !gameCompleted && timeLeft > 0) {
          timer = setInterval(() => {
            setTimeLeft(prev => {
              if (prev <= 1) {
                if (timer) clearInterval(timer);
                return 0;
              }
              return prev - 1;
            });
          }, 1000);
        }
    
        // Cleanup function
        return () => {
          socket?.off("new-question", handleNewQuestion);
          socket?.off("score-update", handleScoreUpdate);
          socket?.off("time-up", handleTimeUp);
          socket?.off("game-completed", handleGameCompleted);
          socket?.off("reveal-answer", handleRevealAnswer);
          socket?.off("player-joined", handlePlayerJoined);
          socket?.off("player-left", handlePlayerLeft);
          
          if (timer) clearInterval(timer);
        };
  }, [roomCode, navigate, socket, currentQuestion, gameCompleted, timeLeft, handleReconnection]);

  // Handler functions
  const handleAnswerSelect = useCallback((answerIndex: number, responseTime: number) => {
    if (!currentQuestion || !socket) return;

    socket.emit(
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
      }
    );
  }, [currentQuestion, socket]);

  const handleLeaveGame = useCallback(async () => {
    try {
      await leaveRoom();
      localStorage.removeItem('quizsmash_username');
      localStorage.removeItem('quizsmash_playerId');
      localStorage.removeItem('quizsmash_roomCode');
      navigate("/");
    } catch (error) {
      console.error("Leave game error:", error);
      navigate("/");
    }
  }, [leaveRoom, navigate]);

  const handlePlayAgain = useCallback(() => {
    navigate(`/lobby/${roomCode}`);
  }, [navigate, roomCode]);

  // Render loading state
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

  // Render game completed state
  if (gameCompleted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4">
        {/* Game completed UI - same as before */}
      </div>
    );
  }

  // Main game UI
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
                    Room: {roomState.roomCode || roomCode}
                  </span>
                  <span className="flex items-center">
                    <Users className="w-4 h-4 mr-1" />
                    {scores.length} players
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
              {roomState.difficulty && (
                <div className="px-4 py-2 bg-primary-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Zap className="w-5 h-5 text-primary-600" />
                    <span className="font-bold text-primary-700">
                      {roomState.difficulty}
                    </span>
                  </div>
                </div>
              )}

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
                  options: currentQuestion.options || [],
                  correctIndex: revealedAnswer ?? -1,
                  round: currentQuestion.round || 1,
                  topic: roomState.topic || "",
                  difficulty: roomState.difficulty || "medium",
                }}
                onAnswerSelect={handleAnswerSelect}
                timeLimit={timeLeft}
                currentRound={currentQuestion?.round || 1}
                totalRounds={currentQuestion?.totalQuestions || 3}
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
                isHost: roomState.players.some(p => p.username === s.username && p.isHost),
                hasAnswered: s.hasAnswered,
              }))}
              currentPlayer={roomState.username}
              currentQuestion={currentQuestion?.round || 1}
              totalQuestions={currentQuestion?.totalQuestions || 3}
            />

            {/* Game Info Panel */}
            <div className="mt-6 bg-white rounded-2xl shadow-lg p-6">
              <h3 className="font-bold text-gray-800 mb-4">Game Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className="font-bold text-green-600">
                    In Progress
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Players Online</span>
                  <span className="font-bold text-primary-700">
                    {scores.length} / {roomState.players.length || scores.length}
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
                <div className="flex justify-between">
                  <span className="text-gray-600">Time Left</span>
                  <span className="font-bold text-amber-600">
                    {timeLeft}s
                  </span>
                </div>
              </div>

              {/* Join Instructions */}
              <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-700">
                  <span className="font-bold">Invite friends:</span> Share room
                  code{" "}
                  <code className="font-mono font-bold">
                    {roomState.roomCode || roomCode}
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