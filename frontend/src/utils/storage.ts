import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { SessionData, Message } from "../types";

export const CrossPlatformStorage =
  Platform.OS === "web"
    ? {
        async getItem(key: string) {
          return localStorage.getItem(key);
        },
        async setItem(key: string, value: string) {
          localStorage.setItem(key, value);
        },
        async removeItem(key: string) {
          localStorage.removeItem(key);
        },
      }
    : AsyncStorage;

export const StorageHelper = {
  async setJSON(key: string, data: unknown) {
    await CrossPlatformStorage.setItem(key, JSON.stringify(data));
  },
  async getJSON<T>(key: string): Promise<T | null> {
    const raw = await CrossPlatformStorage.getItem(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  async removeMultiple(keys: string[]) {
    await Promise.all(keys.map((key) => CrossPlatformStorage.removeItem(key)));
  },
};

type SessionIndex = Record<string, { sessionId: string; lastActive: string }>;
export class SessionManager {
  private static writes: Promise<unknown> = Promise.resolve();
  private static async scope() {
    const identity = await StorageHelper.getJSON<{ user: { id: number } }>(
      "odyssey_identity",
    );
    const user = identity?.user;
    if (!user) throw new Error("No active user");
    return user.id;
  }
  static async getSessionByWorld(
    worldId: string,
  ): Promise<{ session: SessionData | null; messages: Message[] | null }> {
    const userId = await this.scope();
    const [session, messages] = await Promise.all([
      StorageHelper.getJSON<SessionData>(
        `odyssey_session_${userId}_${worldId}`,
      ),
      StorageHelper.getJSON<Message[]>(`odyssey_messages_${userId}_${worldId}`),
    ]);
    return {
      session,
      messages:
        messages?.map((message) => ({
          ...message,
          timestamp: message.timestamp
            ? new Date(message.timestamp)
            : undefined,
        })) ?? null,
    };
  }
  static async saveSessionByWorld(
    worldId: string,
    session: SessionData,
    messages: Message[],
  ): Promise<void> {
    // Capture identity before queuing, so an account switch never changes the owner.
    const userId = await this.scope();
    const save = async () => {
      const key = `odyssey_sessions_index_${userId}`;
      const index = (await StorageHelper.getJSON<SessionIndex>(key)) ?? {};
      await Promise.all([
        StorageHelper.setJSON(`odyssey_session_${userId}_${worldId}`, session),
        StorageHelper.setJSON(
          `odyssey_messages_${userId}_${worldId}`,
          messages,
        ),
      ]);
      index[worldId] = {
        sessionId: session.sessionId,
        lastActive: new Date().toISOString(),
      };
      await StorageHelper.setJSON(key, index);
    };
    const pending = this.writes.then(save, save);
    this.writes = pending.catch(() => {});
    await pending;
  }
  static async getAllActiveSessions() {
    const userId = await this.scope();
    const index =
      (await StorageHelper.getJSON<SessionIndex>(
        `odyssey_sessions_index_${userId}`,
      )) ?? {};
    return Object.entries(index).map(([worldId, item]) => ({
      worldId,
      sessionId: item.sessionId,
      lastActive: new Date(item.lastActive),
    }));
  }
}
