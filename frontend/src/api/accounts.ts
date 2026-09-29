import { API_URL } from "../config";
import { CrossPlatformStorage, StorageHelper } from "../utils/storage";
export interface AccountUser {
  id: number;
  name: string;
  language?: string;
  username: string | null;
  isGuest: boolean;
}
const IDENTITY = "odyssey_identity";
type Identity = { token: string; user: AccountUser };
async function identity(): Promise<Identity | null> {
  const current = await StorageHelper.getJSON<Identity>(IDENTITY);
  if (current) return current;
  // One-time migration for guest sessions created before atomic identity storage.
  const token = await CrossPlatformStorage.getItem("odyssey_token");
  const user = await StorageHelper.getJSON<AccountUser>("odyssey_user");
  if (!token || !user) return null;
  const migrated = { token, user };
  await StorageHelper.setJSON(IDENTITY, migrated);
  await StorageHelper.removeMultiple(["odyssey_token", "odyssey_user"]);
  return migrated;
}
export const AccountSession = {
  async token() {
    return (await identity())?.token ?? null;
  },
  async user() {
    return (await identity())?.user ?? null;
  },
  async save(data: { token?: string; user: AccountUser }) {
    const token = data.token ?? (await identity())?.token;
    if (!token) throw new Error("Missing account session");
    await StorageHelper.setJSON(IDENTITY, { token, user: data.user });
  },
  async clear() {
    await StorageHelper.removeMultiple([
      IDENTITY,
      "odyssey_token",
      "odyssey_user",
    ]);
  },
};
export async function accountRequest(
  path: string,
  body?: unknown,
): Promise<{ token?: string; user: AccountUser }> {
  const token = await AccountSession.token();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`${API_URL}/auth/${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok)
      throw Object.assign(
        new Error(data.message || "Could not connect. Please try again."),
        { status: response.status },
      );
    return data;
  } finally {
    clearTimeout(timeout);
  }
}
