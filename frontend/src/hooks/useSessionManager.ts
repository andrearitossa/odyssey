import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { randomUUID } from "expo-crypto";
import { SessionData, Message } from "../types";
import { createSession, resumeSession } from "../api";
import {
  API_URL,
  ApiError,
  authenticatedFetch,
  handleResponse,
} from "../api/api";
import { SessionManager } from "../utils/storage";
import { parseNarratorResponse } from "../utils/story";

type State = {
  session: SessionData | null;
  messages: Message[];
  phase: "loading" | "ready" | "sending";
  error: string;
  saveWarning: string;
  failedAction: string | null;
  failedRequestId: string | null;
  partialScene: string;
};
const initial: State = {
  session: null,
  messages: [],
  phase: "loading",
  error: "",
  saveWarning: "",
  failedAction: null,
  failedRequestId: null,
  partialScene: "",
};

function requestId(): string {
  return randomUUID();
}

function restoredMessages(
  messages: Array<{
    type: "user" | "narrator";
    content: string;
    created_at: string;
  }>,
): Message[] {
  const firstUser = messages.findIndex((message) => message.type === "user");
  return messages
    .filter(
      (message, index) =>
        index !== firstUser ||
        (message.content !== "-" &&
          message.content !==
            "Begin the story with an immediate situation and a choice."),
    )
    .flatMap((message): Message[] =>
      message.type === "narrator"
        ? parseNarratorResponse(message.content, new Date(message.created_at))
        : [
            {
              type: "user",
              text: message.content,
              timestamp: new Date(message.created_at),
            },
          ],
    );
}

function storyTurnCount(messages: Message[]): number {
  return messages.filter((message) => message.type !== "choice").length;
}

export function useSessionManager() {
  const [state, setState] = useState<State>(initial);
  const latest = useRef(state);
  const operation = useRef(0);
  const locked = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const openingRequests = useRef(new Map<string, string>());
  const update = useCallback((patch: Partial<State>) => {
    latest.current = { ...latest.current, ...patch };
    setState(latest.current);
  }, []);
  useEffect(
    () => () => {
      operation.current++;
      controller.current?.abort();
    },
    [],
  );

  const persist = useCallback(
    async (session: SessionData, messages: Message[], id: number) => {
      try {
        await SessionManager.saveSessionByWorld(
          session.worldId,
          session,
          messages,
        );
        if (id === operation.current) update({ saveWarning: "" });
      } catch {
        if (id === operation.current)
          update({
            saveWarning:
              "Your story is saved online, but this browser couldn’t keep a local copy.",
          });
      }
    },
    [update],
  );

  const interact = useCallback(
    async (
      session: SessionData,
      message: string,
      id: string,
      onDelta?: (scene: string) => void,
    ) => {
      const requestController = new AbortController();
      controller.current = requestController;
      const timeout = setTimeout(() => requestController.abort(), 90000);
      try {
        const response = await authenticatedFetch(
          `${API_URL}/sessions/${session.sessionId}/interact`,
          {
            method: "POST",
            body: JSON.stringify({ message, requestId: id }),
            signal: requestController.signal,
            headers: Platform.OS === "web" ? { Accept: "text/event-stream" } : undefined,
          },
        );
        if (!response.ok) await handleResponse(response);

        let completedResponse: string | null = null;
        if (
          Platform.OS === "web" &&
          response.headers.get("content-type")?.includes("text/event-stream") &&
          response.body?.getReader
        ) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let scene = "";
          let streamError: string | null = null;
          const receiveLine = (line: string) => {
            if (!line.startsWith("data:")) return;
            let event: { delta?: unknown; response?: unknown; done?: unknown; error?: unknown };
            try {
              event = JSON.parse(line.slice(5).trim());
            } catch {
              throw new Error("Invalid streamed story response");
            }
            if (typeof event.error === "string") {
              streamError = event.error;
              return;
            }
            if (typeof event.delta === "string") {
              scene += event.delta;
              onDelta?.(scene.replace(/\n\s*1[.)]\s[\s\S]*$/, "").trim());
            }
            if (event.done === true && typeof event.response === "string")
              completedResponse = event.response;
          };
          while (true) {
            const { value, done } = await reader.read();
            if (value) {
              buffer += decoder.decode(value, { stream: !done });
              const lines = buffer.split(/\r?\n/);
              buffer = lines.pop() ?? "";
              for (const line of lines) receiveLine(line);
            }
            if (done) break;
          }
          buffer += decoder.decode();
          if (buffer) receiveLine(buffer.replace(/\r$/, ""));
          if (streamError) throw new Error(streamError);
          if (completedResponse === null)
            throw new Error("Story stream ended before it was complete");
        } else {
          const data = await handleResponse<{ response: string }>(response);
          completedResponse = data.response;
        }
        const parsed = parseNarratorResponse(completedResponse);
        if (!parsed.length) throw new Error("Empty story response");
        return parsed;
      } finally {
        clearTimeout(timeout);
        if (controller.current === requestController) controller.current = null;
      }
    },
    [],
  );

  const startSession = useCallback(
    async (worldId: string, restart = false) => {
      const id = ++operation.current;
      controller.current?.abort();
      locked.current = true;
      update({ ...initial });
      try {
        let saved = restart
          ? null
          : await SessionManager.getSessionByWorld(worldId);
        // The server can contain turns made on another device. Keep a longer
        // local transcript if it has not reached the server yet.
        if (!restart) {
          try {
            const remote = await resumeSession(worldId);
            if (remote.session) {
              const remoteMessages = restoredMessages(remote.messages);
              if (
                remote.session.sessionId !== saved?.session?.sessionId ||
                storyTurnCount(remoteMessages) >=
                  storyTurnCount(saved.messages ?? [])
              ) {
                saved = { session: remote.session, messages: remoteMessages };
              }
            }
          } catch (error) {
            if (!saved?.session) throw error;
          }
        }
        const session = saved?.session ?? (await createSession(worldId));
        if (id !== operation.current) return;
        const messages = saved?.messages ?? [];
        update({ session, messages });
        // Save the session before its opening, so a failed opening can be retried.
        await persist(session, messages, id);
        if (id !== operation.current) return;
        if (!messages.length) {
          const openingId =
            openingRequests.current.get(session.sessionId) ?? requestId();
          openingRequests.current.set(session.sessionId, openingId);
          const opening = await interact(session, "-", openingId, (partialScene) => {
            if (id === operation.current) update({ partialScene });
          });
          if (id !== operation.current) return;
          openingRequests.current.delete(session.sessionId);
          update({ messages: opening, partialScene: "" });
          await persist(session, opening, id);
        }
      } catch (error) {
        if (id === operation.current)
          update({
            partialScene: "",
            error:
              error instanceof ApiError && error.status === 503
                ? "Stories are unavailable right now. Try again later."
                : "The story couldn’t start. Try opening it again.",
          });
      } finally {
        if (id === operation.current) {
          locked.current = false;
          update({ phase: "ready" });
        }
      }
    },
    [interact, persist, update],
  );

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const { session, messages } = latest.current;
      const message = text.trim();
      if (!session || !message || locked.current) return false;
      locked.current = true;
      const id = ++operation.current;
      const actionId =
        latest.current.failedAction === message
          ? (latest.current.failedRequestId ?? requestId())
          : requestId();
      const optimistic: Message[] = [
        ...messages,
        { type: "user", text: message, timestamp: new Date() },
      ];
      update({
        messages: optimistic,
        partialScene: "",
        phase: "sending",
        error: "",
        failedAction: null,
        failedRequestId: null,
      });
      try {
        const reply = await interact(session, message, actionId, (partialScene) => {
          if (id === operation.current) update({ partialScene });
        });
        if (id !== operation.current) return false;
        const completed = [...optimistic, ...reply];
        update({ messages: completed, partialScene: "" });
        await persist(session, completed, id);
        return true;
      } catch (error) {
        if (id === operation.current)
          update({
            messages,
            partialScene: "",
            failedAction: message,
            failedRequestId: actionId,
            error:
              error instanceof ApiError && error.status === 409
                ? "Another turn is still being written. Try again in a moment."
                : "That action didn’t go through. Your story is still here.",
          });
        return false;
      } finally {
        if (id === operation.current) {
          locked.current = false;
          update({ phase: "ready" });
        }
      }
    },
    [interact, persist, update],
  );

  return {
    messages: state.messages,
    isSessionLoading: state.phase === "loading",
    isInteracting: state.phase === "sending",
    error: state.error,
    saveWarning: state.saveWarning,
    failedAction: state.failedAction,
    partialScene: state.partialScene,
    startSession,
    sendMessage,
    resetSession: (worldId: string) => startSession(worldId, true),
  };
}
