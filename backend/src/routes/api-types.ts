// === API REQUEST/RESPONSE TYPES ===

export interface CreateSessionResponse {
  sessionId: string;
  worldId: string;
  createdAt: string;
}

export interface InteractWithStoryRequest {
  message: string;
  requestId?: string;
}

export interface InteractWithStoryResponse {
  response: string;
}

// === CHAPTER TYPES ===

export interface Chapter {
  id: number;
  session_id: string;
  chapter_number: number;
  title: string;
  description: string;
  status: 'history' | 'current' | 'future';
  decomposition?: string;
  created_at: string;
  updated_at: string;
}

export interface GetChaptersResponse {
  history: Chapter[];
  current: Chapter | null;
  future: Chapter[];
}

// === ERROR TYPES ===

export interface ApiError {
  error: string;
  message: string;
  status: number;
}
