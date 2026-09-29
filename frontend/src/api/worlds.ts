import { API_URL, authenticatedFetch, handleResponse } from "./api";
import { World } from "../types";

// ------------------------------------------------------------
// WORLD MANAGEMENT
// ------------------------------------------------------------

// Get all available worlds
export const getAllWorlds = async (): Promise<World[]> => {
  const response = await authenticatedFetch(`${API_URL}/worlds`, {
    method: "GET",
  });
  return handleResponse(response);
};

// Get a specific world by ID
export const getWorldById = async (worldId: string): Promise<World> => {
  const response = await authenticatedFetch(`${API_URL}/worlds/${worldId}`, {
    method: "GET",
  });
  return handleResponse(response);
};

// Create a new world
export const createWorld = async (
  title: string,
  description?: string,
): Promise<World> => {
  const response = await authenticatedFetch(`${API_URL}/worlds`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ title, description }),
  });
  return handleResponse(response);
};
