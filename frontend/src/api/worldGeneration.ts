import { API_URL } from './api';
import { GoogleTokenManager } from './googleAuth';

export interface WorldGenerationResponse {
  success: boolean;
  audioData?: Blob;
  error?: string;
}

/**
 * World Generation API Service
 */
export class WorldGenerationAPI {
  /**
   * Send audio data to the world generation endpoint and receive audio response
   */
  static async interact(worldId: string, audioBlob: Blob): Promise<{ audioBlob?: Blob; document?: string; error?: string }> {
    try {
      const response = await fetch(`${API_URL}/world-generation/${encodeURIComponent(worldId)}/interact`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await GoogleTokenManager.getStoredToken()}`,
          'Content-Type': 'audio/wav', // Set appropriate content type for audio
        },
        body: audioBlob,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`HTTP ${response.status}: ${text}`);
      }

      const data = await response.json();
      if (!data.success) {
        return { error: data.error || 'Unknown error' };
      }

      // Convert base64 audio back to blob
      let audioBlobResp: Blob | undefined = undefined;
      if (data.audio_base64) {
        const binaryString = atob(data.audio_base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBlobResp = new Blob([bytes.buffer], { type: data.audio_content_type || 'audio/wav' });
      }

      return { audioBlob: audioBlobResp, document: data.document };
    } catch (error) {
      console.error('World Generation API Error:', error);
      throw error;
    }
  }
} 