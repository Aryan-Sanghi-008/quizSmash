import React, { useEffect, useState } from "react";
import {
  Trophy,
  Crown,
  Star,
  TrendingUp,
  Award,
  Zap,
  User,
} from "lucide-react";

interface PlayerScore {
  id: string;
  username: string;
  score: number;
  isHost: boolean;
  hasAnswered?: boolean;
  currentAnswer?: number;
}

interface ScoreBoardProps {
  scores: PlayerScore[];
  currentPlayer: string;
  currentQuestion?: number;
  totalQuestions?: number;
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({
  scores,
  currentPlayer,
  currentQuestion = 1,
  totalQuestions = 3,
}) => {
  const [sortedScores, setSortedScores] = useState<PlayerScore[]>([]);
  const [previousScores, setPreviousScores] = useState<Record<string, number>>(
    {},
  );

  useEffect(() => {
    // Store previous scores for animation
    const newPreviousScores: Record<string, number> = {};
    scores.forEach((player) => {
      newPreviousScores[player.id] = previousScores[player.id] || player.score;
    });
    setPreviousScores(newPreviousScores);

    // Sort scores
    const sorted = [...scores].sort((a, b) => b.score - a.score);
    setSortedScores(sorted);
  }, [scores]);

  const getRankIcon = (index: number) => {
    switch (index) {
      case 0:
        return <Trophy className="w-5 h-5 text-yellow-500" />;
      case 1:
        return <Award className="w-5 h-5 text-gray-400" />;
      case 2:
        return <Star className="w-5 h-5 text-amber-600" />;
      default:
        return <span className="text-gray-500 font-bold">{index + 1}</span>;
    }
  };

  const getRankColor = (index: number) => {
    switch (index) {
      case 0:
        return "from-yellow-100 to-amber-50 border-yellow-300";
      case 1:
        return "from-gray-100 to-gray-50 border-gray-300";
      case 2:
        return "from-amber-100 to-orange-50 border-amber-300";
      default:
        return "from-gray-50 to-white border-gray-200";
    }
  };

  const getScoreChange = (playerId: string, currentScore: number) => {
    const previousScore = previousScores[playerId] || 0;
    return currentScore - previousScore;
  };

  return (
    <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-lg p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-r from-primary-500 to-primary-600 rounded-xl">
            <Trophy className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-800">
              Live Leaderboard
            </h2>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Zap className="w-4 h-4" />
              <span>
                Question {currentQuestion}/{totalQuestions}
              </span>
            </div>
          </div>
        </div>
        <div className="px-4 py-2 bg-primary-50 rounded-lg">
          <span className="text-primary-700 font-semibold">
            {sortedScores.length} Players
          </span>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        {sortedScores.map((player, index) => {
          const scoreChange = getScoreChange(player.id, player.score);
          const isCurrentPlayer = player.username === currentPlayer;

          return (
            <div
              key={player.id}
              className={`relative overflow-hidden rounded-xl border-2 p-4 transition-all duration-300 ${getRankColor(
                index,
              )} ${isCurrentPlayer ? "ring-2 ring-primary-400 ring-offset-1" : ""}`}
            >
              {/* Background rank number */}
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2">
                <span className="text-6xl font-black text-gray-100 opacity-50">
                  {index + 1}
                </span>
              </div>

              <div className="flex items-center justify-between relative z-10">
                {/* Left side: Rank & Player Info */}
                <div className="flex items-center space-x-4">
                  {/* Rank */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      index === 0
                        ? "bg-yellow-100"
                        : index === 1
                          ? "bg-gray-100"
                          : index === 2
                            ? "bg-amber-100"
                            : "bg-gray-100"
                    }`}
                  >
                    {getRankIcon(index)}
                  </div>

                  {/* Player Avatar & Info */}
                  <div className="flex items-center space-x-3">
                    <div
                      className={`relative w-12 h-12 rounded-full flex items-center justify-center ${
                        isCurrentPlayer
                          ? "bg-gradient-to-br from-primary-500 to-primary-600"
                          : "bg-gradient-to-br from-gray-400 to-gray-500"
                      }`}
                    >
                      <User className="w-6 h-6 text-white" />
                      {player.isHost && (
                        <div className="absolute -top-1 -right-1">
                          <Crown className="w-5 h-5 text-yellow-500" />
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-gray-800">
                          {player.username}
                        </span>
                        {isCurrentPlayer && (
                          <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-semibold rounded-full">
                            You
                          </span>
                        )}
                        {player.isHost && !isCurrentPlayer && (
                          <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs font-semibold rounded-full">
                            Host
                          </span>
                        )}
                      </div>

                      {/* Status indicator */}
                      <div className="flex items-center space-x-2 mt-1">
                        {player.hasAnswered ? (
                          <div className="flex items-center text-green-600 text-sm">
                            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                            Answered
                          </div>
                        ) : (
                          <div className="flex items-center text-gray-500 text-sm">
                            <div className="w-2 h-2 bg-gray-400 rounded-full mr-2 animate-pulse"></div>
                            Thinking...
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side: Score */}
                <div className="text-right">
                  <div className="flex items-center justify-end space-x-2">
                    {scoreChange > 0 && (
                      <div className="px-2 py-1 bg-green-100 text-green-700 rounded-lg animate-bounce">
                        <TrendingUp className="w-4 h-4 inline mr-1" />+
                        {scoreChange}
                      </div>
                    )}
                    <div className="text-2xl font-bold text-gray-800">
                      {player.score}
                      <span className="text-sm text-gray-500 ml-1">pts</span>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 mt-1">
                    {index === 0 && "🏆 Leader"}
                    {index === 1 && "🥈 Runner up"}
                    {index === 2 && "🥉 Third place"}
                    {index > 2 && `${player.score / 10} correct answers`}
                  </div>
                </div>
              </div>

              {/* Progress bar showing relative score */}
              {sortedScores.length > 1 && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-primary-500 to-primary-600 h-2 rounded-full transition-all duration-500"
                      style={{
                        width: `${(player.score / (sortedScores[0].score || 1)) * 100}%`,
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Stats footer */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">Total Points</div>
            <div className="text-2xl font-bold text-primary-700">
              {sortedScores.reduce((sum, player) => sum + player.score, 0)}
            </div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600">Average Score</div>
            <div className="text-2xl font-bold text-green-700">
              {sortedScores.length > 0
                ? Math.round(
                    sortedScores.reduce(
                      (sum, player) => sum + player.score,
                      0,
                    ) / sortedScores.length,
                  )
                : 0}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ScoreBoard;
