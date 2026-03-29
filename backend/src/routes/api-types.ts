// === API REQUEST/RESPONSE TYPES ===

export interface CreateSessionResponse {
  sessionId: string;
  worldId: string;
  createdAt: string;
}

export interface InteractWithStoryRequest {
  message: string;
}

export interface InteractWithStoryResponse {
  response: string;
}

export interface ListSessionsResponse {
  sessions: Array<{
    session_id: string;
    world_id: string;
    world_title: string;
    world_description: string | null;
    created_at: string;
    updated_at: string;
  }>;
}

export interface GetSessionDetailsResponse {
  sessionId: string;
  worldId: string;
  createdAt: string;
  updatedAt: string;
}

export interface GetSessionMessagesResponse {
  messages: Array<{
    id: number;
    session_id: string;
    type: 'user' | 'narrator';
    content: string;
    chapter_number: number;
    created_at: string;
  }>;
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