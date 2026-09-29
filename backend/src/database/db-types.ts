// === DATABASE TYPES ===

// Anonymous session for backwards compatibility
export interface AnonymousSession {
  id: number;
  token: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}

// Profile columns retain their legacy names for database compatibility.
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

// Migration tracking
export interface Migration {
  id: number;
  migration_name: string;
  executed_at: string;
}

export interface World {
  id: string;
  title: string;
  description: string | null;
}

export interface Session {
  id: string;
  user_id: number;
  world_id: string;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: number;
  session_id: string;
  type: 'user' | 'narrator';
  content: string;
  chapter_number: number;
  created_at: string;
}

export interface StoryModel {
  id: number;
  session_id: string;
  core_theme_moral_message: string;      // Core theme and moral message
  genre_style_voice: string;             // Genre, style, narrative voice
  setting: string;                       // Setting constraints and world rules
  protagonist: string;                   // Protagonist - user is the main character
  conflict_sources: string;              // Primary conflict sources
  intended_impact: string;               // Intended emotional and intellectual impact
  created_at: string;
  updated_at: string;
}

export interface Chapter {
  id: number;
  session_id: string;
  chapter_number: number;
  title: string;
  description: string;
  status: 'history' | 'current' | 'future';
  decomposition?: string;                // Single line decomposition from Optimizer
  created_at: string;
  updated_at: string;
}


