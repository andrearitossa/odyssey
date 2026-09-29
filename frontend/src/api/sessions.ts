import { API_URL, authenticatedFetch, handleResponse } from "./api";
import { SessionData } from "../types";

/**
 * Session Management API
 */

/**
 * Creates a new game session for a specific world
 */
export const createSession = async (worldId: string): Promise<SessionData> => {
  const response = await authenticatedFetch(`${API_URL}/sessions/new`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ worldId }),
  });

  return handleResponse(response);
};

export async function resumeSession(worldId: string) {
  const response = await authenticatedFetch(
    `${API_URL}/sessions/resume?worldId=${encodeURIComponent(worldId)}`,
  );
  return handleResponse<{
    session: SessionData | null;
    messages: Array<{
      type: "user" | "narrator";
      content: string;
      created_at: string;
    }>;
  }>(response);
}
