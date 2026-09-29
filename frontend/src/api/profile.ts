import { ApiClient } from "./api";

export interface User {
  id: number;
  name: string;
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

export interface ProfileResponse {
  user: User;
  userWorlds: UserWorld[];
}

export interface ProfileUpdateRequest {
  name?: string;
  language?: string;
}

/**
 * Profile API - handles user profile management
 */
export class ProfileAPI {
  private static apiClient = ApiClient.getInstance();

  /**
   * Get user profile with their worlds
   */
  static async getProfile(): Promise<ProfileResponse> {
    return await this.apiClient.get<ProfileResponse>("/profile");
  }

  /**
   * Update user profile (name and/or language)
   */
  static async updateProfile(
    updates: ProfileUpdateRequest,
  ): Promise<ProfileResponse> {
    return await this.apiClient.put<ProfileResponse>("/profile", updates);
  }

  /**
   * Update user name
   */
  static async updateName(name: string): Promise<ProfileResponse> {
    return await this.updateProfile({ name });
  }

  /**
   * Update user language
   */
  static async updateLanguage(language: string): Promise<ProfileResponse> {
    return await this.updateProfile({ language });
  }
}

export const SUPPORTED_LANGUAGES = [
  "English",
  "French",
  "German",
  "Italian",
  "Swedish",
  "Spanish",
  "Portuguese",
] as const;

export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
