import { API_URL, apiClient, authenticatedFetch, handleResponse } from './api';
import { SessionData, GetChaptersResponse } from '../types';

export interface SessionSummary {
  session_id: string;
  world_id: string;
  world_title: string;
  world_description: string | null;
  created_at: string;
  updated_at: string;
}

export interface StoredSessionMessage {
  id: number;
  session_id: string;
  type: 'user' | 'narrator';
  content: string;
  chapter_number: number;
  created_at: string;
}

/**
 * Session Management API
 */

/**
 * Creates a new game session for a specific world
 */
export const createSession = async (worldId: string): Promise<SessionData> => {
  const response = await authenticatedFetch(`${API_URL}/sessions/new`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ worldId })
  });
  
  return handleResponse(response);
};

/**
 * Lists sessions for the authenticated user (most recently updated first)
 */
export const listSessions = async (): Promise<SessionSummary[]> => {
  const result = await apiClient.get<{ sessions: SessionSummary[] }>('/sessions');
  return result.sessions;
};

/**
 * Fetch session details
 */
export const getSessionDetails = async (sessionId: string): Promise<{ sessionId: string; worldId: string; createdAt: string; updatedAt: string }> => {
  return await apiClient.get(`/sessions/${sessionId}`);
};

/**
 * Fetch stored messages for a session
 */
export const getSessionMessages = async (sessionId: string, limit: number = 200): Promise<StoredSessionMessage[]> => {
  const result = await apiClient.get<{ messages: StoredSessionMessage[] }>(
    `/sessions/${sessionId}/messages?limit=${encodeURIComponent(String(limit))}`
  );
  return result.messages;
};

/**
 * Get chapters for a session
 */
export const getChapters = async (token: string, sessionId: string): Promise<GetChaptersResponse> => {
  const response = await authenticatedFetch(`${API_URL}/sessions/${sessionId}/chapters`, {
    method: 'GET',
  });
  
  return handleResponse(response);
};

/**
 * Ends/deletes a session (graceful cleanup)
 */
export const endSession = async (token: string, sessionId: string): Promise<void> => {
  try {
    const response = await fetch(`${API_URL}/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: { 
        'Authorization': `Bearer ${token}`
      }
    });
    
    if (!response.ok) {
      console.warn(`Failed to end session ${sessionId} on server, continuing anyway`);
    }
  } catch (error) {
    console.warn('Error ending session on server:', error);
  }
}; 