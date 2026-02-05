import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import toast from "react-hot-toast";

interface Player {
  id: string;
  username: string;
  score: number;
  isReady: boolean;
  isHost: boolean;
  currentAnswer?: number;
  hasAnswered?: boolean;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  createRoom: (username: string) => Promise<any>;
  joinRoom: (roomCode: string, username: string) => Promise<any>;
  reconnectToRoom: (roomCode: string, username: string) => Promise<any>;
  checkRoom: (roomCode: string) => Promise<any>;
  leaveRoom: () => Promise<any>;
  getActiveRooms: () => Promise<any>;
  connect: () => void;
  disconnect: () => void;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
  createRoom: async () => ({ success: false, error: "Not initialized" }),
  joinRoom: async () => ({ success: false, error: "Not initialized" }),
  reconnectToRoom: async () => ({ success: false, error: "Not initialized" }),
  checkRoom: async () => ({ success: false, error: "Not initialized" }),
  leaveRoom: async () => ({ success: false, error: "Not initialized" }),
  getActiveRooms: async () => ({ success: false, error: "Not initialized" }),
  connect: () => {},
  disconnect: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const isConnecting = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const createSocket = (): Socket => {
    const backendUrl =
      import.meta.env.VITE_BACKEND_URL || "http://localhost:8080";
    console.log("🔌 Creating socket connection to:", backendUrl);

    // Generate unique client ID
    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const newSocket = io(backendUrl, {
      transports: ["polling", "websocket"],
      upgrade: true,
      forceNew: false, // Changed to false for better reconnection

      // Reconnection settings
      reconnection: true,
      reconnectionAttempts: maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,

      // Timeouts
      timeout: 10000,

      // Query parameters for identification
      query: {
        clientId,
        platform: navigator.platform,
        timestamp: Date.now(),
      },

      // Auto-connect
      autoConnect: true,
    });

    return newSocket;
  };

  const connect = () => {
    if (socketRef.current?.connected) {
      console.log("✅ Already connected");
      return;
    }

    // Clean up existing socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    const socket = createSocket();
    socketRef.current = socket;

    // Connection events
    socket.on("connect", () => {
      console.log("✅ Socket connected:", socket.id);
      setIsConnected(true);
      reconnectAttemptsRef.current = 0;
      toast.success("Connected to game server");
    });

    socket.on("disconnect", (reason) => {
      console.log("🔌 Socket disconnected:", reason);
      setIsConnected(false);

      if (reason === "io server disconnect") {
        // Server initiated disconnect
        toast.error("Disconnected by server. Please refresh.");
      } else if (reconnectAttemptsRef.current < maxReconnectAttempts) {
        toast("Reconnecting...", { icon: "🔄" });
      }
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error.message);
      toast.error(`Connection error: ${error.message}`);
    });

    socket.on("reconnect", (attemptNumber) => {
      console.log(`✅ Reconnected after ${attemptNumber} attempts`);
      reconnectAttemptsRef.current = attemptNumber;
      setIsConnected(true);
      toast.success("Reconnected!");
    });

    socket.on("reconnect_attempt", (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      reconnectAttemptsRef.current = attemptNumber;
    });

    socket.on("reconnect_failed", () => {
      console.error("❌ Reconnection failed");
      toast.error("Failed to reconnect. Please refresh the page.");
    });

    // Initial connect
    socket.connect();
  };

  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      setIsConnected(false);
      isConnecting.current = false;
    }
  };

  const createRoom = async (username: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket || !isConnected) {
        reject({ success: false, error: "Not connected to server" });
        return;
      }

      const timeout = setTimeout(() => {
        reject({ success: false, error: "Request timeout" });
      }, 10000);

      socket.emit("create-room", username, (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };

  const joinRoom = async (roomCode: string, username: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket || !isConnected) {
        reject({ success: false, error: "Not connected to server" });
        return;
      }

      const timeout = setTimeout(() => {
        reject({ success: false, error: "Request timeout" });
      }, 10000);

      socket.emit("join-room", { roomCode, username }, (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };

  const reconnectToRoom = async (
    roomCode: string,
    username: string,
  ): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket || !isConnected) {
        reject({ success: false, error: "Not connected to server" });
        return;
      }

      const timeout = setTimeout(() => {
        reject({ success: false, error: "Request timeout" });
      }, 10000);

      socket.emit("reconnect-room", { roomCode, username }, (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };

  const checkRoom = async (roomCode: string): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket || !isConnected) {
        reject({ success: false, error: "Not connected to server" });
        return;
      }

      const timeout = setTimeout(() => {
        reject({ success: false, error: "Request timeout" });
      }, 10000);

      socket.emit("check-room", { roomCode }, (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };

  const leaveRoom = async (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket || !isConnected) {
        reject({ success: false, error: "Not connected to server" });
        return;
      }

      const timeout = setTimeout(() => {
        reject({ success: false, error: "Request timeout" });
      }, 10000);

      socket.emit("leave-room", {}, (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };

  const getActiveRooms = async (): Promise<any> => {
    return new Promise((resolve, reject) => {
      const socket = socketRef.current;

      if (!socket || !isConnected) {
        reject({ success: false, error: "Not connected to server" });
        return;
      }

      const timeout = setTimeout(() => {
        reject({ success: false, error: "Request timeout" });
      }, 10000);

      socket.emit("get-active-rooms", (response: any) => {
        clearTimeout(timeout);
        resolve(response);
      });
    });
  };

  // Initialize connection on mount
  useEffect(() => {
    connect();

    return () => {
      disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket: socketRef.current,
        isConnected,
        createRoom,
        joinRoom,
        reconnectToRoom,
        checkRoom,
        leaveRoom,
        getActiveRooms,
        connect,
        disconnect,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
