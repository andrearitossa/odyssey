import { expect, test } from "@playwright/test";
import worker from "../worker";

test("frontend worker forwards API paths, query, method and body to backend binding", async () => {
  const seen: Request[] = [];
  const env = {
    ASSETS: { fetch: async () => { throw new Error("API request reached assets"); } },
    BACKEND: {
      fetch: async (request: Request) => {
        seen.push(request);
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  };
  const health = await worker.fetch(new Request("https://odyssey.example/api/health?ready=1"), env);
  expect(health.status).toBe(200);
  expect(await health.json()).toEqual({ ok: true });
  expect(new URL(seen[0].url).pathname).toBe("/health");
  expect(new URL(seen[0].url).search).toBe("?ready=1");

  const auth = await worker.fetch(new Request("https://odyssey.example/api/auth/guest", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Test-Header": "preserved" },
    body: JSON.stringify({ invitation: "once upon a time" }),
  }), env);
  expect(auth.status).toBe(200);
  expect(new URL(seen[1].url).pathname).toBe("/auth/guest");
  expect(seen[1].method).toBe("POST");
  expect(seen[1].headers.get("X-Test-Header")).toBe("preserved");
  expect(await seen[1].json()).toEqual({ invitation: "once upon a time" });
});
