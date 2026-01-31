import React, { useState, useEffect, useRef } from "react";
import type { Question } from "../types/game";
import {
  Clock,
  Award,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  Target,
} from "lucide-react";

interface QuestionDisplayProps {
  question: Question;
  onAnswerSelect: (answerIndex: number, responseTime: number) => void;
  timeLimit?: number;
  currentRound: number;
  totalRounds: number;
}

const QuestionDisplay: React.FC<QuestionDisplayProps> = ({
  question,
  onAnswerSelect,
  timeLimit = 20,
  currentRound,
  totalRounds,
}) => {
  const [timeLeft, setTimeLeft] = useState(timeLimit);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [showCorrect, setShowCorrect] = useState(false);
  const [responseTime, setResponseTime] = useState<number>(0);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<number | null>(null);

  // Progress for timer circle
  const progress = (timeLeft / timeLimit) * 100;

  useEffect(() => {
    // Reset states when new question arrives
    setTimeLeft(timeLimit);
    setSelectedAnswer(null);
    setHasAnswered(false);
    setShowCorrect(false);
    setResponseTime(0);
    startTimeRef.current = Date.now();

    // Start timer
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          if (!hasAnswered) {
            setHasAnswered(true);
            setShowCorrect(true);
            onAnswerSelect(-1, timeLimit);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [question.id]);

  const handleAnswerClick = (index: number) => {
    if (hasAnswered) return;

    const endTime = Date.now();
    const timeTaken = (endTime - startTimeRef.current) / 1000;

    setSelectedAnswer(index);
    setHasAnswered(true);
    setResponseTime(timeTaken);
    setShowCorrect(true);

    // Clear timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    onAnswerSelect(index, timeTaken);
  };

  const getOptionLetter = (index: number) => {
    return String.fromCharCode(65 + index);
  };

  const getOptionStyle = (index: number) => {
    if (!hasAnswered) {
      return "hover:scale-[1.02] hover:shadow-lg transition-all duration-200 cursor-pointer border-2 border-gray-200";
    }

    if (index === selectedAnswer) {
      return selectedAnswer === question.correctIndex
        ? "bg-gradient-to-r from-green-50 to-emerald-100 border-2 border-green-500 shadow-lg"
        : "bg-gradient-to-r from-red-50 to-rose-100 border-2 border-red-500 shadow-lg";
    }

    if (index === question.correctIndex && showCorrect) {
      return "bg-gradient-to-r from-green-50 to-emerald-100 border-2 border-green-500 shadow-lg";
    }

    return "bg-gray-50 border-2 border-gray-200";
  };

  const getOptionIcon = (index: number) => {
    if (!hasAnswered) return null;

    if (index === selectedAnswer) {
      return selectedAnswer === question.correctIndex ? (
        <CheckCircle className="w-6 h-6 text-green-500 ml-2" />
      ) : (
        <XCircle className="w-6 h-6 text-red-500 ml-2" />
      );
    }

    if (index === question.correctIndex && showCorrect) {
      return <CheckCircle className="w-6 h-6 text-green-500 ml-2" />;
    }

    return null;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Header with progress */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Target className="w-5 h-5 text-primary-600" />
            <span className="text-lg font-semibold text-gray-700">
              Round {currentRound} • Question {question.round}/{totalRounds}
            </span>
          </div>
          <div className="px-3 py-1 bg-gradient-to-r from-primary-100 to-blue-100 rounded-full">
            <span className="text-sm font-medium text-primary-700">
              {question.difficulty?.charAt(0).toUpperCase() +
                question.difficulty?.slice(1) || "Medium"}
            </span>
          </div>
        </div>

        {/* Circular Timer */}
        <div className="relative">
          <div className="w-20 h-20 relative">
            {/* Background circle */}
            <svg
              className="w-full h-full transform -rotate-90"
              viewBox="0 0 100 100"
            >
              {/* Background */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke="#e5e7eb"
                strokeWidth="8"
              />
              {/* Progress circle */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                stroke={
                  timeLeft > 10
                    ? "#10b981"
                    : timeLeft > 5
                      ? "#f59e0b"
                      : "#ef4444"
                }
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${progress * 2.827} 283`}
              />
            </svg>
            {/* Timer text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <Clock
                className={`w-5 h-5 mb-1 ${
                  timeLeft > 10
                    ? "text-green-500"
                    : timeLeft > 5
                      ? "text-yellow-500"
                      : "text-red-500"
                }`}
              />
              <span
                className={`text-xl font-bold ${
                  timeLeft > 10
                    ? "text-green-700"
                    : timeLeft > 5
                      ? "text-yellow-700"
                      : "text-red-700"
                }`}
              >
                {timeLeft}s
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Question Card */}
      <div className="bg-gradient-to-br from-white to-gray-50 rounded-2xl shadow-xl p-8 mb-8 border border-gray-100">
        <div className="flex items-center mb-4">
          <Zap className="w-6 h-6 text-primary-500 mr-3" />
          <h3 className="text-lg font-semibold text-primary-700">Question</h3>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-gray-800 leading-tight">
          {question.question}
        </h2>
        {question.topic && (
          <div className="mt-4 inline-flex items-center px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
            Topic: {question.topic}
          </div>
        )}
      </div>

      {/* Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {question.options.map((option, index) => (
          <button
            key={index}
            onClick={() => handleAnswerClick(index)}
            disabled={hasAnswered}
            className={`p-6 rounded-xl text-left transition-all duration-300 ${getOptionStyle(index)}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4 flex-1">
                <div
                  className={`flex-shrink-0 w-12 h-12 flex items-center justify-center rounded-xl font-bold text-lg ${
                    !hasAnswered
                      ? "bg-gradient-to-br from-primary-500 to-primary-600 text-white"
                      : index === question.correctIndex
                        ? "bg-gradient-to-br from-green-500 to-green-600 text-white"
                        : index === selectedAnswer
                          ? "bg-gradient-to-br from-red-500 to-red-600 text-white"
                          : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {getOptionLetter(index)}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-gray-800 text-lg">
                    {option}
                  </div>
                  {hasAnswered && index === question.correctIndex && (
                    <div className="mt-3 flex items-center text-green-600 font-semibold">
                      <Award className="w-4 h-4 mr-2" />
                      Correct Answer
                    </div>
                  )}
                </div>
              </div>
              {getOptionIcon(index)}
            </div>
          </button>
        ))}
      </div>

      {/* Status Messages */}
      {hasAnswered && selectedAnswer !== null && (
        <div
          className={`mt-6 p-6 rounded-2xl text-center font-semibold animate-slide-up ${
            selectedAnswer === question.correctIndex
              ? "bg-gradient-to-r from-green-50 to-emerald-100 border-2 border-green-200"
              : "bg-gradient-to-r from-red-50 to-rose-100 border-2 border-red-200"
          }`}
        >
          <div className="flex flex-col items-center">
            {selectedAnswer === question.correctIndex ? (
              <>
                <div className="w-16 h-16 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  🎉 Correct!
                </h3>
                <p className="text-gray-600">
                  Well done! You answered in {responseTime.toFixed(1)}s
                </p>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-rose-500 rounded-full flex items-center justify-center mb-4">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">
                  ✗ Incorrect
                </h3>
                <p className="text-gray-600">Better luck next question!</p>
              </>
            )}
          </div>
        </div>
      )}

      {hasAnswered && selectedAnswer === null && (
        <div className="mt-6 p-6 bg-gradient-to-r from-yellow-50 to-amber-100 border-2 border-yellow-200 rounded-2xl text-center animate-slide-up">
          <div className="flex items-center justify-center mb-3">
            <AlertCircle className="w-6 h-6 text-yellow-600 mr-3" />
            <h3 className="text-xl font-bold text-yellow-800">Time's Up!</h3>
          </div>
          <p className="text-yellow-700">
            The correct answer was highlighted above.
          </p>
        </div>
      )}

      {/* Instructions */}
      {!hasAnswered && (
        <div className="mt-8 p-4 bg-gray-50 rounded-xl border border-gray-200">
          <div className="flex items-center text-sm text-gray-600">
            <span className="font-medium mr-2">💡 Tip:</span>
            Click on an option or use keyboard keys 1-4 to answer quickly
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionDisplay;
