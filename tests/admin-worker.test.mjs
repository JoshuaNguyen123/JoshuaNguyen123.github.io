import assert from "node:assert/strict";
import test from "node:test";
import worker from "../admin-worker/src/index.mjs";

const session = "a".repeat(43);
const origin = "https://joshuanguyen123.github.io";

function environment(record = { login: "JoshuaNguyen123", accessToken: "server-only-token" }) {
  const values = new Map([[`session:${session}`, JSON.stringify(record)]]);
  return {
    SESSIONS: {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => values.set(key, value),
      delete: async (key) => values.delete(key),
    },
  };
}

function configuredEnvironment() {
  return {
    ...environment(),
    GITHUB_CLIENT_ID: "public-client-id",
    GITHUB_CLIENT_SECRET: "server-only-secret",
    OAUTH_CALLBACK_URL: "https://admin.example/auth/callback",
  };
}

function apiRequest(path, init = {}) {
  return new Request(`https://admin.example${path}`, {
    ...init,
    headers: { Origin: origin, Authorization: `Bearer ${session}`, ...(init.headers ?? {}) },
  });
}

test("admin API rejects untrusted origins and missing sessions", async () => {
  const env = environment();
  const wrongOrigin = await worker.fetch(new Request("https://admin.example/api/me", { headers: { Origin: "https://attacker.example" } }), env);
  assert.equal(wrongOrigin.status, 403);
  assert.equal(wrongOrigin.headers.get("Access-Control-Allow-Origin"), null);
  const noSession = await worker.fetch(new Request("https://admin.example/api/me", { headers: { Origin: origin } }), env);
  assert.equal(noSession.status, 401);
});

test("admin API accepts only the configured owner identity", async () => {
  const accepted = await worker.fetch(apiRequest("/api/me"), environment());
  assert.equal(accepted.status, 200);
  assert.deepEqual(await accepted.json(), { login: "JoshuaNguyen123" });
  const rejected = await worker.fetch(apiRequest("/api/me"), environment({ login: "someone-else", accessToken: "token" }));
  assert.equal(rejected.status, 401);
});

test("admin API contains writes inside content/blog and requires matching frontmatter", async () => {
  const traversal = await worker.fetch(apiRequest("/api/posts/%2E%2E%2FREADME", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "anything" }),
  }), environment());
  assert.equal(traversal.status, 400);
  assert.match((await traversal.json()).error, /slug/i);

  const mismatch = await worker.fetch(apiRequest("/api/posts/safe-post", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source: `---\nslug: other-post\ntitle: Other\nsummary: Summary\npublishedAt: 2026-08-24\ntags: ["test"]\ndraft: true\n---\n\nBody\n`,
    }),
  }), environment());
  assert.equal(mismatch.status, 400);
  assert.match((await mismatch.json()).error, /does not match/i);
});

test("GitHub sign-in fails closed when unconfigured and throttles repeated starts", async () => {
  const unconfigured = await worker.fetch(new Request("https://admin.example/auth/login"), environment());
  assert.equal(unconfigured.status, 503);

  const env = configuredEnvironment();
  const first = await worker.fetch(new Request("https://admin.example/auth/login", { headers: { "CF-Connecting-IP": "192.0.2.1" } }), env);
  assert.equal(first.status, 302);
  assert.equal(new URL(first.headers.get("Location")).hostname, "github.com");
  const repeated = await worker.fetch(new Request("https://admin.example/auth/login", { headers: { "CF-Connecting-IP": "192.0.2.1" } }), env);
  assert.equal(repeated.status, 429);
});

test("admin writes reject bodies above the bounded request size", async () => {
  const oversized = await worker.fetch(apiRequest("/api/posts/safe-post", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "x".repeat(120_001) }),
  }), environment());
  assert.equal(oversized.status, 413);
});
