import { API_URL, authenticatedFetch, handleResponse } from './api';
import { World } from '../types';

// ------------------------------------------------------------
// WORLD MANAGEMENT
// ------------------------------------------------------------

// Get all available worlds
export const getAllWorlds = async (token: string): Promise<World[]> => {
  const response = await authenticatedFetch(`${API_URL}/worlds/all`, {
    method: 'GET',
  });
  return handleResponse(response);
};

// Get worlds created by the authenticated user
export const getMyWorlds = async (token: string): Promise<World[]> => {
  const response = await authenticatedFetch(`${API_URL}/worlds`, {
    method: 'GET',
  });
  return handleResponse(response);
};

// Get a specific world by ID
export const getWorldById = async (token: string, worldId: string): Promise<World> => {
  const response = await authenticatedFetch(`${API_URL}/worlds/${worldId}`, {
    method: 'GET',
  });
  return handleResponse(response);
};

// Create a new world
export const createWorld = async (token: string, title: string, description?: string): Promise<World> => {
  const response = await authenticatedFetch(`${API_URL}/worlds`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, description })
  });
  return handleResponse(response);
}; 

// Update an existing world (manual edits)
export const updateWorld = async (
  token: string,
  worldId: string,
  updates: { title?: string; description?: string | null }
): Promise<World> => {
  const response = await authenticatedFetch(`${API_URL}/worlds/${worldId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updates),
  });
  return handleResponse(response);
};