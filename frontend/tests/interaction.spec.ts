import { test, expect, Page } from "@playwright/test";
import { parseNarratorResponse, currentChoices } from "../src/utils/story";

const guest = { id: 1, name: "Adventurer", language: "English", username: null as string | null, isGuest: true };
const opening =
  "A small brass key rests on the desk. Somewhere beyond the shelves, a page turns.\n\n1. Pick up the brass key\n2. Follow the sound\n3. Ask the librarian";
const next =
  "The key is warm in your hand. A hidden door swings open.\n\n1. Step through the door\n2. Call into the darkness";
async function setup(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const worlds = [
    {
      id: "midnight",
      title: "The Midnight Library",
      description: "Behind an unmarked door, every book opens a world.",
    },
    {
      id: "stars",
      title: "Beyond the Last Star",
      description: "An impossible signal at the edge of known space.",
    },
  ];
  const state = {
    calls: [] as string[],
    sessions: 0,
    guests: 0,
    unexpected: [] as string[],
    failNext: false,
    failCreate: false,
    failWorlds: false,
    failMeNetwork: false,
    failAfterCommit: false,
    holdAfterCommit: false,
    releaseCommit: null as (() => void) | null,
    openingText: opening,
    delayMs: 250,
    created: [] as any[],
    requestIds: [] as string[],
    streamRequests: 0,
    replayed: 0,
    jsonReplay: false,
    replies: new Map<string, string>(),
    users: new Map<string, typeof guest>(),
    accounts: new Map<string, { password: string; user: typeof guest }>(),
    stories: new Map<number, Array<{ sessionId: string; worldId: string; createdAt: string; messages: Array<{type: 'user' | 'narrator'; content: string; created_at: string}> }>>(),
  };
  const signIn = (user: typeof guest) => {
    const token = `test-token-${user.id}-${Math.random()}`;
    state.users.set(token, user);
    return { token, user };
  };
  const stories = (id: number) => {
    if (!state.stories.has(id)) state.stories.set(id, []);
    return state.stories.get(id)!;
  };
  const stream = (response: string) => {
    if (response.startsWith('{')) {
      const turn = JSON.parse(response);
      if (turn.format === 'story-v1') return `data: ${JSON.stringify({ response: turn.scene, turn, done: true })}\n\n`;
    }
    return `data: ${JSON.stringify({ delta: response.slice(0, Math.ceil(response.length / 2)) })}\n` +
    `data: ${JSON.stringify({ delta: response.slice(Math.ceil(response.length / 2)) })}\n\n` +
    `data: ${JSON.stringify({ response, done: true })}\n\n`;
  };
  // All API traffic is intercepted: these tests never call production or AI services.
  await page.route("http://localhost:8787/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const user = state.users.get(request.headers().authorization?.replace(/^Bearer /, '') ?? '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (path === '/auth/guest' && request.method() === 'POST') {
      const fresh = { ...guest, id: ++state.guests };
      return json(signIn(fresh));
    }
    if (path === '/auth/me' && request.method() === 'GET') {
      if (state.failMeNetwork) return json({ message: 'Temporarily unavailable' }, 503);
      return json(user ? { user } : { message: 'Expired' }, user ? 200 : 401);
    }
    if (path === '/auth/logout' && request.method() === 'POST') {
      state.users.delete(request.headers().authorization?.replace(/^Bearer /, '') ?? '');
      return json({ success: true });
    }
    if (path === '/auth/register' && request.method() === 'POST') {
      if (!user) return json({ message: 'Expired' }, 401);
      const { username, password } = request.postDataJSON();
      if (state.accounts.has(username)) return json({ message: 'Username taken' }, 409);
      const registered = { ...user, username, isGuest: false };
      state.accounts.set(username, { password, user: registered });
      return json({ user: registered });
    }
    if (path === '/auth/login' && request.method() === 'POST') {
      const { username, password } = request.postDataJSON();
      const account = state.accounts.get(username);
      if (!account || account.password !== password) return json({ message: 'Incorrect username or password' }, 401);
      return json(signIn(account.user));
    }
    if (!user) return json({ message: 'Expired' }, 401);
    if (path === "/worlds") {
      if (request.method() === "POST") {
        if (state.failCreate) {
          state.failCreate = false;
          return route.fulfill({ status: 503, json: { error: "Unavailable" } });
        }
        const world = { id: "created-world", ...request.postDataJSON() };
        state.created.push(world);
        worlds.push(world);
        return route.fulfill({ json: world });
      }
      if (state.failWorlds)
        return route.fulfill({ status: 503, json: { error: "Unavailable" } });
      return route.fulfill({ json: worlds });
    }
    if (path === '/sessions/resume') {
      const story = [...stories(user.id)].reverse().find(s => s.worldId === url.searchParams.get('worldId'));
      return json(story ? { session: story, messages: story.messages } : { session: null, messages: [] });
    }
    if (path === "/sessions/new") {
      state.sessions++;
      const session = { sessionId: `session_${state.sessions}`, worldId: request.postDataJSON().worldId, createdAt: new Date().toISOString(), messages: [] };
      stories(user.id).push(session);
      return route.fulfill({
        json: session,
      });
    }
    if (path.endsWith("/interact")) {
      const story = stories(user.id).find(s => path === `/sessions/${s.sessionId}/interact`);
      if (!story) return json({ message: 'Story not found' }, 404);
      const { message, requestId } = request.postDataJSON();
      const key = `${story.sessionId}:${requestId}`;
      if (state.replies.has(key)) {
        state.replayed++;
        const response = state.replies.get(key)!;
        if (!state.jsonReplay && request.headers().accept?.includes('text/event-stream')) {
          state.streamRequests++;
          return route.fulfill({
            headers: { 'Content-Type': 'text/event-stream' },
            body: stream(response),
          });
        }
        return json({ response });
      }
      state.calls.push(message);
      state.requestIds.push(requestId);
      await new Promise((resolve) => setTimeout(resolve, state.delayMs));
      if (state.failNext) {
        state.failNext = false;
        return route.fulfill({ status: 503, json: { error: "Unavailable" } });
      }
      const response = message === '-' ? state.openingText : next;
      const created_at = new Date().toISOString();
      story.messages.push({ type: 'user', content: message, created_at }, { type: 'narrator', content: response, created_at });
      state.replies.set(key, response);
      if (state.failAfterCommit) {
        state.failAfterCommit = false;
        return json({ message: 'Response lost after commit' }, 503);
      }
      if (state.holdAfterCommit) {
        state.holdAfterCommit = false;
        await new Promise<void>(resolve => { state.releaseCommit = resolve; });
      }
      if (request.headers().accept?.includes('text/event-stream')) {
        state.streamRequests++;
        return route.fulfill({
          headers: { 'Content-Type': 'text/event-stream' },
          body: stream(response),
        });
      }
      return json({ response });
    }
    if (path === "/profile") {
      if (request.method() === "PUT") Object.assign(user, request.postDataJSON());
      const userWorlds = stories(user.id).map(s => ({session_id:s.sessionId, world_id:s.worldId, world_title:worlds.find(w => w.id === s.worldId)?.title ?? 'World', world_description:null, created_at:s.createdAt, updated_at:s.createdAt}));
      return json({ user, userWorlds });
    }
    state.unexpected.push(`${request.method()} ${path}`);
    return json({ error: "Unmocked API route" }, 501);
  });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Enter The Midnight Library" }),
  ).toBeVisible();
  return { state, errors };
}
async function enter(page: Page) {
  await page
    .getByRole("button", { name: /(?:Enter|Continue) The Midnight Library/ })
    .click();
  await expect(
    page.getByRole("button", { name: /Pick up the brass key/ }),
  ).toBeVisible();
}

test("only trailing choices are interactive", () => {
  const messages = parseNarratorResponse(
    "1. A date in a diary\nSome more prose.\n\n1. Open it\n2. Leave",
  );
  expect(messages[0].text).toContain("1. A date in a diary");
  expect(currentChoices(messages).map((m) => m.text)).toEqual([
    "Open it",
    "Leave",
  ]);
  expect(
    currentChoices([...messages, { type: "user", text: "Open it" }]),
  ).toEqual([]);
  expect(parseNarratorResponse("It is 2.5 miles away.")).toHaveLength(1);
  expect(parseNarratorResponse("The door opens. Now you can enter, hide, or flee.\n\n1. Enter\n2. Hide\n3. Flee")[0].text).toBe("The door opens.");
});

test("a new visitor can play immediately as a guest", async ({ page }) => {
  const { state, errors } = await setup(page);
  expect(state.guests).toBe(1);
  await enter(page);
  expect(state.calls).toEqual(["-"]);
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await page.getByRole("tab", { name: /You/ }).click();
  await expect(page.getByText("Playing as a guest")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add username & password" })).toBeVisible();
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("the opening offers three clear actions and shows work while writing", async ({ page }) => {
  const { state, errors } = await setup(page);
  await enter(page);
  const labels = ["Pick up the brass key", "Follow the sound", "Ask the librarian"];
  for (const label of labels) await expect(page.getByRole("button", { name: label })).toBeVisible();
  expect(new Set(labels).size).toBe(3);
  expect(labels.every(label => label.length < 80)).toBe(true);
  state.delayMs = 900;
  await page.getByRole("button", { name: "Ask the librarian" }).click();
  await expect(page.getByRole("progressbar", { name: "Writing your story" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Pick up the brass key" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  expect(state.calls).toEqual(["-", "Ask the librarian"]);
  expect(state.streamRequests).toBe(2);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("optional account keeps progress and sign in isolates saved stories", async ({ page }) => {
  const { state, errors } = await setup(page);
  await enter(page);
  await page.getByRole("button", { name: /Pick up the brass key/ }).click();
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "Add username & password" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill("reader");
  await page.getByRole("textbox", { name: "Password" }).fill("a-long-secret-password");
  await page.getByRole("button", { name: "Save my account" }).click();
  await expect(page.getByText("Signed in as reader")).toBeVisible();
  expect(state.guests).toBe(1);
  expect(state.accounts.get("reader")?.user.id).toBe(1);
  await page.getByRole("tab", { name: /Explore/ }).click();
  await page.getByRole("button", { name: /(?:Enter|Continue) The Midnight Library/ }).click();
  await expect(page.getByText("Pick up the brass key", { exact: true })).toBeVisible();
  expect(state.sessions).toBe(1);
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Enter The Midnight Library" })).toBeVisible();
  expect(state.guests).toBe(2);
  // Simulate another device: the account's browser cache is gone, but its server story remains.
  await page.evaluate(() => {
    localStorage.removeItem("odyssey_session_1_midnight");
    localStorage.removeItem("odyssey_messages_1_midnight");
    localStorage.removeItem("odyssey_sessions_index_1");
  });
  await page.getByRole("tab", { name: /You/ }).click();
  await expect(page.getByText("Playing as a guest")).toBeVisible();
  await page.getByRole("button", { name: "I already have an account" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill("reader");
  await page.getByRole("textbox", { name: "Password" }).fill("a-long-secret-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as reader")).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("odyssey_identity")!).user.id)).toBe(1);
  await page.getByRole("tab", { name: /Explore/ }).click();
  await page.getByRole("button", { name: /(?:Enter|Continue) The Midnight Library/ }).click();
  await expect(page.getByText("Pick up the brass key", { exact: true })).toBeVisible();
  expect(state.sessions).toBe(1);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("two accounts on one browser keep their story transcripts separate", async ({ page }) => {
  const { state, errors } = await setup(page);
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "Add username & password" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill("alice");
  await page.getByRole("textbox", { name: "Password" }).fill("alice-password-long");
  await page.getByRole("button", { name: "Save my account" }).click();
  await expect(page.getByText("Signed in as alice")).toBeVisible();
  await page.getByRole("tab", { name: /Explore/ }).click();
  await enter(page);
  await page.getByRole("textbox", { name: "Your own action" }).fill("Alice follows the lamp");
  await page.getByRole("button", { name: "Send action" }).click();
  await expect(page.getByText("Alice follows the lamp", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Enter The Midnight Library" })).toBeVisible();
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "Add username & password" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill("bob");
  await page.getByRole("textbox", { name: "Password" }).fill("bob-password-long");
  await page.getByRole("button", { name: "Save my account" }).click();
  await expect(page.getByText("Signed in as bob")).toBeVisible();
  await page.getByRole("tab", { name: /Explore/ }).click();
  await enter(page);
  await expect(page.getByText("Alice follows the lamp", { exact: true })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Your own action" }).fill("Bob opens the window");
  await page.getByRole("button", { name: "Send action" }).click();
  await expect(page.getByText("Bob opens the window", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("button", { name: "Enter The Midnight Library" })).toBeVisible();
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "I already have an account" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill("alice");
  await page.getByRole("textbox", { name: "Password" }).fill("alice-password-long");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByText("Signed in as alice")).toBeVisible();
  await page.getByRole("tab", { name: /Explore/ }).click();
  await page.getByRole("button", { name: /(?:Enter|Continue) The Midnight Library/ }).click();
  await expect(page.getByText("Alice follows the lamp", { exact: true })).toBeVisible();
  await expect(page.getByText("Bob opens the window", { exact: true })).toHaveCount(0);
  expect(state.stories.get(1)).toHaveLength(1);
  expect(state.stories.get(2)).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("choice, custom action, saved resume and confirmed restart", async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  await enter(page);
  await page.getByRole("button", { name: /Pick up the brass key/ }).dblclick();
  await expect(
    page.getByRole("button", { name: /Step through the door/ }),
  ).toBeVisible();
  expect(state.calls).toEqual(["-", "Pick up the brass key"]);
  await expect(
    page.getByRole("button", { name: /Pick up the brass key/ }),
  ).toHaveCount(0);
  await page
    .getByRole("textbox", { name: "Your own action" })
    .fill("I inspect the door");
  await page.getByRole("textbox", { name: "Your own action" }).press("Enter");
  await expect(
    page.getByRole("button", { name: /Step through the door/ }),
  ).toBeVisible();
  expect(state.calls.at(-1)).toBe("I inspect the door");
  await page.reload();
  await page
    .getByRole("button", { name: "Continue The Midnight Library" })
    .click();
  await expect(
    page.getByText("I inspect the door", { exact: true }),
  ).toBeVisible();
  expect(state.sessions).toBe(1);
  expect(state.calls).toHaveLength(3);
  await page.getByRole("button", { name: "Restart story" }).click();
  await page.getByRole("button", { name: "Keep my story" }).click();
  expect(state.sessions).toBe(1);
  await page.getByRole("button", { name: "Restart story" }).click();
  await page.getByRole("button", { name: "Start over", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /Pick up the brass key/ }),
  ).toBeVisible();
  expect(state.sessions).toBe(2);
  await expect(
    page.getByText("I inspect the door", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("Enter sends once, Shift+Enter keeps a newline, and IME composition does not send", async ({ page }) => {
  const { state, errors } = await setup(page);
  await enter(page);
  const composer = page.getByRole("textbox", { name: "Your own action" });
  await composer.fill("I wait");
  await composer.press("Shift+Enter");
  await expect(composer).toHaveValue("I wait\n");
  expect(state.calls).toEqual(["-"]);
  await composer.press("Enter");
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  expect(state.calls).toEqual(["-", "I wait"]);
  await composer.fill("I listen");
  await composer.evaluate(element => {
    element.dispatchEvent(new KeyboardEvent("keypress", { key: "Enter", bubbles: true, isComposing: true }));
  });
  await expect(composer).toHaveValue("I listen");
  expect(state.calls).toHaveLength(2);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("rejected sign in and registration preserve guest identity, draft and story", async ({ page }) => {
  const { state, errors } = await setup(page);
  await enter(page);
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("button", { name: "I already have an account" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill("nobody");
  await page.getByRole("textbox", { name: "Password" }).fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Incorrect username or password");
  await expect(page.getByText("Playing as a guest")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue("nobody");
  expect(state.guests).toBe(1);
  await page.getByRole("button", { name: "Keep playing as guest" }).click();
  state.accounts.set("taken", { password: "another-password", user: { ...guest, id: 99, username: "taken", isGuest: false } });
  await page.getByRole("button", { name: "Add username & password" }).click();
  await page.getByRole("textbox", { name: "Username" }).fill("taken");
  await page.getByRole("textbox", { name: "Password" }).fill("my-long-password");
  await page.getByRole("button", { name: "Save my account" }).click();
  await expect(page.getByRole("alert")).toContainText("Username taken");
  await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue("taken");
  await expect(page.getByRole("textbox", { name: "Password" })).toHaveValue("my-long-password");
  await page.getByRole("button", { name: "Keep playing as guest" }).click();
  await page.getByRole("tab", { name: /Explore/ }).click();
  await page.getByRole("button", { name: "Continue The Midnight Library" }).click();
  await expect(page.getByRole("button", { name: /Pick up the brass key/ })).toBeVisible();
  expect(state.sessions).toBe(1);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("temporary reconnect does not create a new guest or lose story", async ({ page }) => {
  const { state, errors } = await setup(page);
  await enter(page);
  const identity = await page.evaluate(() => localStorage.getItem("odyssey_identity"));
  state.failMeNetwork = true;
  await page.reload();
  await expect(page.getByRole("button", { name: "Reconnect" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("odyssey_identity"))).toBe(identity);
  expect(state.guests).toBe(1);
  state.failMeNetwork = false;
  await page.getByRole("button", { name: "Reconnect" }).click();
  await page.getByRole("button", { name: "Continue The Midnight Library" }).click();
  await expect(page.getByRole("button", { name: /Pick up the brass key/ })).toBeVisible();
  expect(state.sessions).toBe(1);
  expect(state.guests).toBe(1);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("lost response retries the same request without duplicating the committed turn", async ({ page }) => {
  const { state, errors } = await setup(page);
  await enter(page);
  state.failAfterCommit = true;
  await page.getByRole("button", { name: /Pick up the brass key/ }).click();
  await expect(page.getByRole("button", { name: "Try this action again" })).toBeVisible();
  await page.getByRole("button", { name: "Try this action again" }).click();
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  expect(state.calls).toEqual(["-", "Pick up the brass key"]);
  expect(state.replayed).toBe(1);
  expect(state.requestIds).toHaveLength(2);
  expect(state.stories.get(1)![0].messages.filter(message => message.content === "Pick up the brass key")).toHaveLength(1);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("a long generated opening starts at its beginning", async ({ page }) => {
  const { state, errors } = await setup(page);
  state.openingText = `The first paragraph begins here.\n\n${Array.from({ length: 70 }, (_, index) => `Paragraph ${index + 1} fills the world with atmosphere and detail.`).join("\n\n")}\n\n1. Pick up the brass key\n2. Follow the sound`;
  await enter(page);
  const storyScrollTop = await page.getByText(/The first paragraph begins here/).evaluate(element => {
    let parent = element.parentElement;
    while (parent && parent.scrollHeight <= parent.clientHeight + 100) parent = parent.parentElement;
    return parent?.scrollTop ?? -1;
  });
  expect(storyScrollTop).toBeGreaterThanOrEqual(0);
  expect(storyScrollTop).toBeLessThan(100);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("navigating away during a committed turn resumes it on return", async ({ page }) => {
  const { state, errors } = await setup(page);
  await enter(page);
  state.holdAfterCommit = true;
  await page.getByRole("button", { name: /Pick up the brass key/ }).click();
  await expect.poll(() => state.releaseCommit).not.toBeNull();
  await page.getByRole("button", { name: "Back to worlds" }).click();
  state.releaseCommit!();
  await page.getByRole("button", { name: /(?:Enter|Continue) The Midnight Library/ }).click();
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  await expect(page.getByText("Pick up the brass key", { exact: true })).toBeVisible();
  expect(state.sessions).toBe(1);
  expect(state.calls).toEqual(["-", "Pick up the brass key"]);
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

test("failed opening and failed send can be retried without duplicate messages", async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  state.failNext = true;
  await page
    .getByRole("button", { name: "Enter The Midnight Library" })
    .click();
  await page.getByRole("button", { name: "Open story again" }).click();
  await expect(
    page.getByRole("button", { name: /Pick up the brass key/ }),
  ).toBeVisible();
  expect(state.sessions).toBe(1);
  state.failNext = true;
  await page
    .getByRole("textbox", { name: "Your own action" })
    .fill("I open the book");
  await page.getByRole("button", { name: "Send action" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your story is still here",
  );
  await expect(
    page.getByRole("textbox", { name: "Your own action" }),
  ).toHaveValue("I open the book");
  await page.getByRole("button", { name: "Try this action again" }).click();
  await expect(
    page.getByRole("button", { name: /Step through the door/ }),
  ).toBeVisible();
  await expect(page.getByText("I open the book", { exact: true })).toHaveCount(
    1,
  );
  expect(errors).toEqual([]);
});

test("search, inspiration, failed creation preserves draft, create goes straight to story", async ({
  page,
}) => {
  const { state, errors } = await setup(page);
  await page
    .getByRole("textbox", { name: "Search worlds" })
    .fill("no such world");
  await expect(
    page.getByText("No worlds found.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByRole("button", { name: "Create a world  +" }).click();
  await expect(
    page.getByRole("button", { name: "Create & step inside  →" }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "✧  A little magic" }).click();
  await expect(page.getByRole("textbox", { name: "World name" })).toHaveValue(
    "The Midnight Library",
  );
  state.failCreate = true;
  await page.getByRole("button", { name: "Create & step inside  →" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Your idea is still here",
  );
  await expect(
    page.getByRole("textbox", { name: "World description" }),
  ).not.toBeEmpty();
  await page
    .getByRole("button", { name: "Create & step inside  →" })
    .dblclick();
  await expect(
    page.getByRole("button", { name: /Pick up the brass key/ }),
  ).toBeVisible();
  expect(state.created).toHaveLength(1);
  expect(state.sessions).toBe(1);
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await expect(page.getByRole("button", { name: "Continue The Midnight Library", exact: true })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "World name" })).not.toBeVisible();
  expect(errors).toEqual([]);
});

test("mobile layout, profile editing, world loading recovery and sign-out", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const { state, errors } = await setup(page);
  await expect(
    page.getByRole("button", { name: "Enter Beyond the Last Star" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: /You/ }).click();
  await page.getByRole("textbox", { name: "Your name" }).fill("Wanderer");
  await page.getByRole("radio", { name: "Italian", exact: true }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("button", { name: "Changes saved ✓" }),
  ).toBeVisible();
  state.failWorlds = true;
  await page.getByRole("tab", { name: /Explore/ }).click();
  await expect(page.getByRole("alert")).toContainText("worlds couldn’t load");
  state.failWorlds = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await enter(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Back to worlds" }).click();
  await page.getByRole("tab", { name: /You/ }).click();
  await expect(page.getByText("Playing as a guest")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add username & password" })).toBeVisible();
  expect(state.unexpected).toEqual([]);
  expect(errors).toEqual([]);
});

for (const separator of [" ", ". ", ") ", ": ", " - ", " — "]) {
  test(`choice parser accepts ${JSON.stringify(separator)} while preserving cues`, () => {
    const messages = parseNarratorResponse(`The gate shuts.\n\n1${separator}Help Tommy — lose time\n2${separator}Call the steward — attract attention\n3${separator}Wait — water rises`);
    expect(messages[0].text).toBe("The gate shuts.");
    expect(currentChoices(messages).map(choice => choice.text)).toEqual(["Help Tommy — lose time", "Call the steward — attract attention", "Wait — water rises"]);
    expect(currentChoices(parseNarratorResponse("A diary.\n2 Leave\n3 Wait"))).toEqual([]);
  });
}

test("unpunctuated choices show their stakes, send them intact", async ({ page }) => {
  const { state } = await setup(page);
  state.openingText = "The gate shuts.\n\n1 Help Tommy — lose time\n2 Call the steward — attract attention\n3 Wait — water rises";
  await page.getByRole("button", { name: "Enter The Midnight Library" }).click();
  await page.getByRole("button", { name: /Help Tommy — lose time/ }).click();
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  expect(state.calls.at(-1)).toBe("Help Tommy — lose time");
});

test("web retries also accept JSON from a non-streaming backend", async ({ page }) => {
  const { state } = await setup(page);
  await enter(page);
  state.failAfterCommit = true;
  state.jsonReplay = true;
  await page.getByRole("button", { name: /Pick up the brass key/ }).click();
  await page.getByRole("button", { name: "Try this action again" }).click();
  await expect(page.getByRole("button", { name: /Step through the door/ })).toBeVisible();
  expect(state.replayed).toBe(1);
  expect(state.calls).toHaveLength(2);
});

const structuredOpening = {
  format: 'story-v1', scene: 'A steward blocks the gate.',
  choices: [
    { label: 'Ask for help', action: 'I ask the steward to help', riskCue: 'costs time' },
    { label: 'Wait nearby', action: 'I wait beside the gate', riskCue: 'water rises' },
    { label: 'Call out', action: 'I call out for my sibling', riskCue: 'draws attention' },
  ],
};

test('structured turns preserve exact prose and choices without numbered-text parsing', () => {
  const messages = parseNarratorResponse(JSON.stringify(structuredOpening));
  expect(messages[0].text).toBe(structuredOpening.scene);
  expect(currentChoices(messages).map(m => m.action)).toEqual(structuredOpening.choices.map(c => c.action));
  expect(currentChoices(messages)[0].text).toBe('Ask for help — costs time');
});

test('structured choices render, survive reload, and submit the action rather than the cue', async ({ page }) => {
  const { state, errors } = await setup(page);
  state.openingText = JSON.stringify(structuredOpening);
  await page.getByRole('button', { name: 'Enter The Midnight Library' }).click();
  await expect(page.getByText('A steward blocks the gate.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ask for help — costs time' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Continue The Midnight Library' }).click();
  await page.getByRole('button', { name: 'Ask for help — costs time' }).click();
  await expect(page.getByRole('button', { name: /Step through the door/ })).toBeVisible();
  expect(state.calls).toEqual(['-', 'I ask the steward to help']);
  expect(errors).toEqual([]);
});
