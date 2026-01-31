import axios from "axios";

const API_BASE_URL = import.meta.env.VITE_BACKEND_URL;

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Room API calls
export const roomAPI = {
  // Get all active rooms
  getActiveRooms: async () => {
    const response = await apiClient.get("/rooms/active");
    return response.data;
  },

  // Get room details by code
  getRoomByCode: async (code: string) => {
    const response = await apiClient.get(`/rooms/${code}`);
    return response.data;
  },

  // Validate room code
  validateRoomCode: async (code: string) => {
    const response = await apiClient.post("/rooms/validate", { code });
    return response.data;
  },

  // Get server health
  getHealth: async () => {
    const response = await apiClient.get("/health");
    return response.data;
  },
};
