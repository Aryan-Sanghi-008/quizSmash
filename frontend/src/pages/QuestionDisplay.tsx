import React, { useState, useEffect } from "react";
import type { Question } from "../types/game";

interface QuestionDisplayProps {
  question: Question;
  onAnswerSelect: (answerIndex: number) => void;
  timeLimit?: number;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  onAnswerSelect,
  timeLimit = 20,
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);

  useEffect(() => {
    setTimeLeft(timeLimit);
    setSelectedAnswer(null);
    setHasAnswered(false);
  }, [question]);

  useEffect(() => {
    if (timeLeft <= 0 && !hasAnswered) {
      setHasAnswered(true);
      onAnswerSelect(-1); // Timeout
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, hasAnswered]);

  const handleAnswerClick = (index: number) => {
    if (hasAnswered) return;

    setSelectedAnswer(index);
    setHasAnswered(true);
    onAnswerSelect(index);
  };

  const getOptionLetter = (index: number) => {
    return String.fromCharCode(65 + index); // A, B, C, D
  };

  const getOptionStyle = (index: number) => {
    if (!hasAnswered) {
      return "hover:bg-gray-50 hover:border-primary-300";
    }

    if (index === selectedAnswer) {
      return selectedAnswer === question.correctIndex
        ? "bg-green-100 border-green-500 text-green-800"
        : "bg-red-100 border-red-500 text-red-800";
    }

    if (index === question.correctIndex) {
      return "bg-green-100 border-green-500 text-green-800";
    }

    return "bg-gray-100";
  };

  return (
    <div className="max-w-3xl mx-auto">
      {/* Timer and Round Info */}
      <div className="flex justify-between items-center mb-6">
        <div className="text-lg font-semibold text-gray-700">
          Question {question.round}
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-lg font-semibold text-gray-700">Time Left:</div>
          <div
            className={`text-2xl font-bold px-4 py-2 rounded-lg ${
              timeLeft > 10
                ? "bg-green-100 text-green-700"
                : timeLeft > 5
                  ? "bg-yellow-100 text-yellow-700"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="card mb-8">
        <div className="mb-2 text-sm text-primary-600 font-semibold">
          Question
        </div>
        <h2 className="text-2xl font-bold text-gray-800 leading-tight">
          {question.question}
        </h2>
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerClick(index)}
            disabled={hasAnswered}
            className={`p-6 border-2 rounded-xl text-left transition-all duration-200 ${getOptionStyle(index)} ${
              !hasAnswered ? "cursor-pointer" : "cursor-default"
            }`}
          >
            <div className="flex items-start space-x-4">
              <div
                className={`w-10 h-10 flex items-center justify-center rounded-lg font-bold ${
                  !hasAnswered
                    ? "bg-primary-100 text-primary-700"
                    : index === question.correctIndex
                      ? "bg-green-500 text-white"
                      : index === selectedAnswer
                        ? "bg-red-500 text-white"
                        : "bg-gray-200 text-gray-700"
                }`}
              >
                {getOptionLetter(index)}
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-800">{option}</div>
                {hasAnswered && index === question.correctIndex && (
                  <div className="mt-2 text-sm text-green-600 font-semibold">
                    ✓ Correct Answer
                  </div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* Status Message */}
      {hasAnswered && selectedAnswer !== null && (
        <div
          className={`mt-6 p-4 rounded-lg text-center font-semibold ${
            selectedAnswer === question.correctIndex
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {selectedAnswer === question.correctIndex
            ? "🎉 Correct! Well done!"
            : "✗ Incorrect. Better luck next question!"}
        </div>
      )}

      {hasAnswered && selectedAnswer === null && (
        <div className="mt-6 p-4 bg-yellow-100 text-yellow-800 rounded-lg text-center font-semibold">
          ⏰ Time's up! The correct answer was highlighted.
        </div>
      )}
    </div>
  );
};

export default QuestionDisplay;
