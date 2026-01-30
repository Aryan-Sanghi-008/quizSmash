import React, { useState } from 'react';
import { useSocket } from '../contexts/SocketContext';

const LandingPage: React.FC = () => {
  const { socket } = useSocket();
  const [username, setUsername] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const handleCreateRoom = () => {
    if (!username.trim()) {
      alert('Please enter a username');
      return;
    }
    
    setIsCreating(true);
    socket?.emit('create-room', username, (response: any) => {
      setIsCreating(false);
    });
  };

  const handleJoinRoom = () => {
    if (!username.trim() || !roomCode.trim()) {
      alert('Please enter both username and room code');
      return;
    }
    
    setIsJoining(true);
    socket?.emit('join-room', { roomCode: roomCode.toUpperCase(), username }, (response: any) => {
      setIsJoining(false);
    });
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-5xl font-bold text-primary-700 mb-2">QuizSmash</h1>
          <p className="text-gray-600">Real-time multiplayer quiz battles with AI-generated questions</p>
        </div>

        {/* Main Card */}
        <div className="card">
          <div className="space-y-6">
            {/* Username Input */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                Your Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your nickname"
                className="input-field"
                maxLength={20}
              />
            </div>

            {/* Create Room Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Create New Room</h2>
              <button
                onClick={handleCreateRoom}
                disabled={isCreating || !username.trim()}
                className="btn-primary w-full flex items-center justify-center"
              >
                {isCreating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating Room...
                  </>
                ) : 'Create New Room'}
              </button>
            </div>

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">OR</span>
              </div>
            </div>

            {/* Join Room Section */}
            <div className="space-y-4">
              <h2 className="text-xl font-semibold text-gray-800">Join Existing Room</h2>
              <div>
                <label htmlFor="roomCode" className="block text-sm font-medium text-gray-700 mb-2">
                  Room Code
                </label>
                <input
                  id="roomCode"
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                  placeholder="Enter 6-letter code"
                  className="input-field uppercase tracking-widest"
                  maxLength={6}
                  style={{ letterSpacing: '0.2em' }}
                />
              </div>
              <button
                onClick={handleJoinRoom}
                disabled={isJoining || !username.trim() || !roomCode.trim()}
                className="btn-secondary w-full flex items-center justify-center"
              >
                {isJoining ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Joining Room...
                  </>
                ) : 'Join Room'}
              </button>
            </div>
          </div>
        </div>

        {/* Features List */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
            <span>AI-generated questions</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
            <span>Up to 4 players</span>
          </div>
          <div className="flex items-center justify-center space-x-2">
            <div className="w-2 h-2 bg-primary-500 rounded-full"></div>
            <span>Real-time multiplayer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LandingPage;