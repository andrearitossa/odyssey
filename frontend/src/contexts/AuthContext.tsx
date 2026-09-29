import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { AccountSession, AccountUser, accountRequest } from "../api/accounts";
import { setGlobalAuthErrorHandler } from "../api/api";
interface AuthContextType {
  user: AccountUser | null;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  error: string;
  checkAuth: () => Promise<boolean>;
  signOut: () => Promise<void>;
  saveAccount: (
    username: string,
    password: string,
    login: boolean,
  ) => Promise<void>;
}
const AuthContext = createContext<AuthContextType | undefined>(undefined);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccountUser | null>(null);
  const [isAuthLoading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const checking = useRef<Promise<boolean> | null>(null);
  const checkAuth = useCallback(() => {
    if (checking.current) return checking.current;
    const task = (async () => {
      setLoading(true);
      setError("");
      try {
        let data;
        if (await AccountSession.token()) {
          try {
            data = await accountRequest("me");
          } catch (error) {
            if ((error as { status?: number }).status !== 401) throw error;
            await AccountSession.clear();
          }
        }
        data ??= await accountRequest("guest", {});
        await AccountSession.save(data);
        setUser(data.user);
        return true;
      } catch {
        setError(
          "Couldn’t connect to Odyssey. Check your connection and try again.",
        );
        return false;
      } finally {
        setLoading(false);
      }
    })();
    checking.current = task;
    void task.finally(() => {
      checking.current = null;
    });
    return task;
  }, []);
  const signOut = useCallback(async () => {
    await accountRequest("logout", {});
    await AccountSession.clear();
    setUser(null);
    await checkAuth();
  }, [checkAuth]);
  const saveAccount = useCallback(
    async (username: string, password: string, login: boolean) => {
      const data = await accountRequest(login ? "login" : "register", {
        username,
        password,
      });
      await AccountSession.save(data);
      setUser(data.user);
    },
    [],
  );
  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);
  useEffect(() => {
    setGlobalAuthErrorHandler(async () => {
      setError("Your session expired. Reconnect to continue.");
      setUser(null);
      await AccountSession.clear();
    });
    return () => setGlobalAuthErrorHandler(null);
  }, []);
  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isAuthLoading,
        error,
        checkAuth,
        signOut,
        saveAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required");
  return value;
}
