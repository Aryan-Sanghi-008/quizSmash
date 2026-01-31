import React from "react";
import { useSocket } from "../contexts/SocketContext";
import { Wifi, WifiOff, RefreshCw } from "lucide-react";

const ConnectionStatus: React.FC = () => {
  const { isConnected, connect } = useSocket();

  return (
    <div className="fixed top-4 right-4 z-50">
      <div
        className={`flex items-center space-x-2 px-4 py-2 rounded-lg shadow-lg ${
          isConnected
            ? "bg-green-100 text-green-800"
            : "bg-red-100 text-red-800"
        }`}
      >
        {isConnected ? (
          <>
            <Wifi className="w-4 h-4" />
            <span className="text-sm font-medium">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-4 h-4" />
            <span className="text-sm font-medium">Disconnected</span>
            <button
              onClick={connect}
              className="ml-2 p-1 hover:bg-red-200 rounded"
              title="Reconnect"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;
