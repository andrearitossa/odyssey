import { useState, useEffect } from 'react';
import { SessionData, Message } from '../types';
import { createSession, getSessionDetails, getSessionMessages } from '../api';
import { API_URL, authenticatedFetch, handleResponse } from '../api/api';
import { SessionManager } from '../utils/storage';

interface UseSessionManagerReturn {
  currentSession: SessionData | null;
  messages: Message[];
  isSessionLoading: boolean;
  isInteracting: boolean;
  // Session management
  startSession: (worldId: string, sessionId?: string) => Promise<void>;
  resetSession: (worldId: string) => Promise<void>;
  endSession: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  // Multi-session support
  switchToWorld: (worldId: string) => Promise<void>;
  hasSessionForWorld: (worldId: string) => Promise<boolean>;
  getAllActiveSessions: () => Promise<Array<{worldId: string, sessionId: string, lastActive: Date}>>;
}

// Helper function to parse narrator response and split into narrative text and choices
const parseNarratorResponse = (response: string, timestamp: Date): Message[] => {
  const lines = response.split('\n');
  const narrativeLines: string[] = [];
  const choices: { number: number; text: string }[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^(\d+)[\)\.\-\s]+(.+)$/);
    
    if (match) {
      const number = parseInt(match[1]);
      const text = match[2].trim();
      if (number >= 1 && number <= 10 && text.length > 0) {
        choices.push({ number, text });
        continue;
      }
    }
    
    // If it's not a choice, add to narrative
    narrativeLines.push(line);
  }
  
  const messages: Message[] = [];
  
  // Add narrator message with cleaned narrative text (remove empty lines at the end)
  const narrativeText = narrativeLines.join('\n').replace(/\n\s*\n\s*$/, '').trim();
  if (narrativeText) {
    messages.push({
      type: 'narrator',
      text: narrativeText,
      timestamp: timestamp
    });
  }
  
  // Add choice messages
  choices.forEach(choice => {
    messages.push({
      type: 'choice',
      text: choice.text,
      timestamp: timestamp,
      choiceNumber: choice.number
    });
  });
  
  return messages;
};

const parseDbDate = (value: string): Date => {
  // D1/SQLite often returns `YYYY-MM-DD HH:MM:SS` which JS parses inconsistently.
  // Normalize to an ISO-ish string when needed.
  const trimmed = (value || '').trim();
  if (!trimmed) return new Date();

  const normalized = trimmed.includes(' ') && !trimmed.includes('T')
    ? `${trimmed.replace(' ', 'T')}Z`
    : trimmed;

  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? new Date() : date;
};

export const useSessionManager = (): UseSessionManagerReturn => {
  const [currentSession, setCurrentSession] = useState<SessionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isSessionLoading, setIsSessionLoading] = useState(false);
  const [isInteracting, setIsInteracting] = useState(false);

  // Cleanup old sessions periodically
  useEffect(() => {
    const cleanup = async () => {
      try {
        await SessionManager.cleanupOldSessions(7); // Clean up sessions older than 7 days
      } catch (error) {
        console.warn('Failed to cleanup old sessions:', error);
      }
    };
    
    cleanup();
  }, []);

  // Auto-save current session when state changes
  useEffect(() => {
    const saveCurrentSession = async () => {
      if (currentSession && messages.length > 0) {
        try {
          await SessionManager.saveSessionByWorld(currentSession.worldId, currentSession, messages);
        } catch (error) {
          console.error('Failed to auto-save session:', error);
        }
      }
    };

    saveCurrentSession();
  }, [currentSession, messages]);

  const startSession = async (worldId: string, sessionId?: string) => {
    setIsSessionLoading(true);

    try {
      // If an explicit sessionId is provided, prefer loading it from the server
      if (sessionId) {
        const details = await getSessionDetails(sessionId);
        const stored = await getSessionMessages(sessionId, 500);

        const resumedSession: SessionData = {
          sessionId: details.sessionId,
          worldId: details.worldId,
          createdAt: details.createdAt,
        };

        const resumedMessages: Message[] = [];
        for (const msg of stored) {
          const ts = parseDbDate(msg.created_at);
          if (msg.type === 'user') {
            resumedMessages.push({ type: 'user', text: msg.content, timestamp: ts });
          } else {
            resumedMessages.push(...parseNarratorResponse(msg.content, ts));
          }
        }

        setCurrentSession(resumedSession);
        setMessages(resumedMessages);
        await SessionManager.saveSessionByWorld(details.worldId, resumedSession, resumedMessages);
        setIsSessionLoading(false);
        return;
      }

      const existingSession = await SessionManager.getSessionByWorld(worldId);

      if (existingSession.session && existingSession.messages) {
        setCurrentSession(existingSession.session);
        setMessages(existingSession.messages);
        setIsSessionLoading(false);
        return;
      }

      const session = await createSession(worldId);

      setCurrentSession(session);
      setMessages([]);
      await SessionManager.saveSessionByWorld(worldId, session, []);

      setIsSessionLoading(false);
      await autoSendStartMessage(session, []);
    } catch (error) {
      console.error('Failed to start session:', error);
      setIsSessionLoading(false);
      throw error;
    }
  };

  const resetSession = async (worldId: string) => {
    setIsInteracting(false);
    
    try {
      // Remove existing session data
      await SessionManager.removeSessionByWorld(worldId);
      
      // Clear current state if it's for this world
      if (currentSession?.worldId === worldId) {
        setCurrentSession(null);
        setMessages([]);
      }
      
      // Start new session
      await startSession(worldId);
    } catch (error) {
      console.error('Failed to reset session:', error);
      throw error;
    }
  };

  const endSession = async () => {
    if (currentSession) {
      try {
        // Keep the session in storage, just clear from memory
        // This allows resuming later
        setCurrentSession(null);
        setMessages([]);
        setIsInteracting(false);
      } catch (error) {
        console.error('Failed to end session:', error);
      }
    }
  };

  const switchToWorld = async (worldId: string) => {
    try {
      // Save current session before switching
      if (currentSession && messages.length > 0) {
        await SessionManager.saveSessionByWorld(currentSession.worldId, currentSession, messages);
      }

      // Load session for new world
      const existingSession = await SessionManager.getSessionByWorld(worldId);
      
      if (existingSession.session && existingSession.messages) {
        setCurrentSession(existingSession.session);
        setMessages(existingSession.messages);
      } else {
        // No session exists for this world, start a new one
        await startSession(worldId);
      }
    } catch (error) {
      console.error('Failed to switch to world:', error);
      throw error;
    }
  };

  const hasSessionForWorld = async (worldId: string): Promise<boolean> => {
    return await SessionManager.hasSessionForWorld(worldId);
  };

  const getAllActiveSessions = async (): Promise<Array<{worldId: string, sessionId: string, lastActive: Date}>> => {
    return await SessionManager.getAllActiveSessions();
  };

  const autoSendStartMessage = async (session: SessionData, currentMessages: Message[]) => {
    setIsInteracting(true);
    
    try {
      // Send FIRST message and get response using authenticatedFetch
      const response = await authenticatedFetch(`${API_URL}/sessions/${session.sessionId}/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: "-" }),
      });

      const data = await handleResponse<{ response: string }>(response);
      console.log('Auto-start API Response:', data); // Debug log
      
      // Parse the narrator response into narrative and choice messages
      console.log('Auto-start parsing response:', data.response); // Debug log
      const parsedMessages = parseNarratorResponse(data.response, new Date());
      console.log('Auto-start parsed messages:', parsedMessages); // Debug log
      
      const finalMessages = [...currentMessages, ...parsedMessages];
      console.log('Auto-start final messages to set:', finalMessages); // Debug log
      setMessages(finalMessages);
    } catch (error) {
      console.error('Failed to auto-send start message:', error);
    } finally {
      setIsInteracting(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!currentSession) {
      throw new Error('No active session');
    }
    
    setIsInteracting(true);
    
    try {
      // Add user message immediately
      const userMessage: Message = {
        type: 'user',
        text: message,
        timestamp: new Date()
      };
      
      const updatedMessages = [...messages, userMessage];
      setMessages(updatedMessages);
      
      // Send message and get response using authenticatedFetch
      const response = await authenticatedFetch(`${API_URL}/sessions/${currentSession.sessionId}/interact`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });

      const data = await handleResponse<{ response: string }>(response);
      console.log('API Response:', data); // Debug log
      
      // Parse the narrator response into narrative and choice messages
      console.log('Parsing response:', data.response); // Debug log
      const parsedMessages = parseNarratorResponse(data.response, new Date());
      console.log('Parsed messages:', parsedMessages); // Debug log
      
      const finalMessages = [...updatedMessages, ...parsedMessages];
      console.log('Final messages to set:', finalMessages); // Debug log
      setMessages(finalMessages);
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    } finally {
      setIsInteracting(false);
    }
  };

  return {
    currentSession,
    messages,
    isSessionLoading,
    isInteracting,
    startSession,
    resetSession,
    endSession,
    sendMessage,
    switchToWorld,
    hasSessionForWorld,
    getAllActiveSessions,
  };
};