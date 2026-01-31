import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { SocketProvider } from "./contexts/SocketContext";
import { RoomProvider } from "./contexts/RoomContext";
import LandingPage from "./pages/LandingPage";
import LobbyPage from "./pages/LobbyPage";
import "./index.css";
import GamePage from "./pages/GamePage";

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/lobby" element={<LobbyPage />} />
        <Route path="/game" element={<GamePage />} />
      </Routes>
    </Router>
  );
};

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SocketProvider>
      <RoomProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#1f2937",
              color: "#fff",
            },
          }}
        />
      </RoomProvider>
    </SocketProvider>
  </React.StrictMode>,
);
