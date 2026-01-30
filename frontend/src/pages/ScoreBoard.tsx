import React from "react";

interface PlayerScore {
  username: string;
  score: number;
}

interface ScoreBoardProps {
  scores: PlayerScore[];
  currentPlayer: string;
}

const ScoreBoard: React.FC<ScoreBoardProps> = ({ scores, currentPlayer }) => {
  const sortedScores = [...scores].sort((a, b) => b.score - a.score);

  return (
    <div className="card">
      <h2 className="text-2xl font-bold text-gray-800 mb-4">Live Scores</h2>
      <div className="space-y-3">
        {sortedScores.map((player, index) => (
          <div
            key={player.username}
            className={`flex items-center justify-between p-3 rounded-lg ${
              player.username === currentPlayer
                ? "bg-primary-50 border-2 border-primary-200"
                : "bg-gray-50"
            }`}
          >
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
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
              <div>
                <span className="font-semibold text-gray-800">
                  {player.username}
                  {player.username === currentPlayer && (
                    <span className="ml-2 text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded">
                      You
                    </span>
                  )}
                </span>
              </div>
            </div>
            <div className="text-xl font-bold text-primary-700">
              {player.score}
              <span className="text-sm text-gray-500 ml-1">pts</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScoreBoard;
