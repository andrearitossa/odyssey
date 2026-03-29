export interface World {
  id: string;
  creator_id?: number | null;
  title: string;
  description: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SessionData {
  sessionId: string;
  worldId: string;
  createdAt: string;
}

export interface Message {
  type: 'user' | 'narrator' | 'choice';
  text: string;
  timestamp?: Date;
  choiceNumber?: number; // For choice messages
}

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

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

// === USER TYPES ===

export interface User {
  id: number;
  google_id: string;
  email: string;
  name: string;
  picture_url?: string;
  language: string;
  created_at: string;
  updated_at: string;
  last_login_at: string;
}

export interface UserWorld {
  session_id: string;
  world_id: string;
  world_title: string;
  world_description: string | null;
  created_at: string;
  updated_at: string;
}

// === AUTH TYPES ===

// Bottom Tab Navigator types
export type BottomTabParamList = {
  Home: undefined;
  Search: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  GoogleAuth: undefined;
  MainTabs: undefined;
  Session: { worldId: string; worldTitle?: string; sessionId?: string };
  Chapters: { sessionId: string; worldTitle?: string };
  WorldGeneration: { worldId: string };
};