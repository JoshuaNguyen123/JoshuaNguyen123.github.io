import assert from "node:assert/strict";
import test from "node:test";
import worker, { verifyOAuthState } from "../admin-worker/src/index.mjs";

const session = "a".repeat(43);
const origin = "https://joshuanguyen123.github.io";

function environment(record = { login: "JoshuaNguyen123", accessToken: "server-only-token" }) {
  const values = new Map([[`session:${session}`, JSON.stringify(record)]]);
  return {
    __values: values,
    SESSIONS: {
      get: async (key) => values.get(key) ?? null,
      put: async (key, value) => values.set(key, value),
      delete: async (key) => values.delete(key),
      list: async ({ prefix }) => ({ keys: [...values.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name })), list_complete: true }),
    },
  };
}

function configuredEnvironment() {
  return {
    ...environment(),
    GITHUB_CLIENT_ID: "public-client-id",
    GITHUB_CLIENT_SECRET: "server-only-secret",
    OAUTH_CALLBACK_URL: "https://admin.example/auth/callback",
    HCAPTCHA_SECRET: "captcha-secret",
    WEB3FORMS_ACCESS_KEY: "relay-secret",
    AUTH_START_RATE_LIMITER: { limit: async () => ({ success: true }) },
    AUTH_CALLBACK_RATE_LIMITER: { limit: async () => ({ success: true }) },
    CONTACT_RATE_LIMITER: { limit: async () => ({ success: true }) },
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

test("GitHub sign-in fails closed when unconfigured and uses signed state without KV writes", async () => {
  const unconfigured = await worker.fetch(new Request("https://admin.example/auth/login"), environment());
  assert.equal(unconfigured.status, 503);

  const env = configuredEnvironment();
  const first = await worker.fetch(new Request("https://admin.example/auth/login", { headers: { "CF-Connecting-IP": "192.0.2.1" } }), env);
  assert.equal(first.status, 302);
  const authorization = new URL(first.headers.get("Location"));
  assert.equal(authorization.hostname, "github.com");
  assert.equal(await verifyOAuthState(authorization.searchParams.get("state"), env.GITHUB_CLIENT_SECRET), true);
  const repeated = await worker.fetch(new Request("https://admin.example/auth/login", { headers: { "CF-Connecting-IP": "192.0.2.1" } }), env);
  assert.equal(repeated.status, 302);
  assert.deepEqual([...env.__values.keys()], [`session:${session}`]);
});

test("OAuth start and callback use separate actor limits after signed-state validation", async () => {
  const env = configuredEnvironment();
  const startKeys = [];
  env.AUTH_START_RATE_LIMITER.limit = async ({ key }) => { startKeys.push(key); return { success: true }; };
  const login = await worker.fetch(new Request("https://admin.example/auth/login"), env);
  await worker.fetch(new Request("https://admin.example/auth/login", { headers: { "CF-Connecting-IP": "192.0.2.8", "User-Agent": "rotated-a" } }), env);
  await worker.fetch(new Request("https://admin.example/auth/login", { headers: { "CF-Connecting-IP": "192.0.2.8", "User-Agent": "rotated-b" } }), env);
  assert.equal(startKeys.at(-1), startKeys.at(-2), "attacker-controlled User-Agent must not create a new limiter actor");
  const state = new URL(login.headers.get("Location")).searchParams.get("state");
  const originalFetch = globalThis.fetch;
  let exchanges = 0;
  let callbackChecks = 0;
  env.AUTH_CALLBACK_RATE_LIMITER.limit = async ({ key }) => {
    callbackChecks += 1;
    assert.match(key, /^callback:/);
    return { success: callbackChecks === 1 };
  };
  globalThis.fetch = async () => { exchanges += 1; return Response.json({ error: "bad code" }, { status: 400 }); };
  try {
    const callback = `https://admin.example/auth/callback?code=invalid&state=${encodeURIComponent(state)}`;
    assert.equal((await worker.fetch(new Request(callback), env)).status, 502);
    assert.equal((await worker.fetch(new Request(callback), env)).status, 429);
    assert.equal(exchanges, 1);
    const checksBeforeInvalidState = callbackChecks;
    assert.equal((await worker.fetch(new Request("https://admin.example/auth/callback?code=x&state=invalid"), env)).status, 400);
    assert.equal(callbackChecks, checksBeforeInvalidState);
    env.AUTH_START_RATE_LIMITER.limit = async () => ({ success: false });
    assert.equal((await worker.fetch(new Request("https://admin.example/auth/login"), env)).status, 429);
  } finally { globalThis.fetch = originalFetch; }
});

test("drafts are stored outside GitHub and returned from private storage", async () => {
  const env = environment();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("draft save must not call GitHub"); };
  try {
    const response = await worker.fetch(apiRequest("/api/posts/safe-post", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source: `---\nslug: safe-post\ntitle: Safe\nsummary: Summary\npublishedAt: 2026-08-25\ntags:\n  - test\ndraft: true\n---\n\nPrivate body\n` }),
    }), env);
    assert.equal(response.status, 200);
    assert.match(env.__values.get("draft:safe-post"), /Private body/);
    assert.doesNotMatch(env.__values.get("draft:safe-post"), /server-only-token/);
  } finally { globalThis.fetch = originalFetch; }
});

test("contact relay verifies captcha server-side before sending", async () => {
  const env = configuredEnvironment();
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).includes("hcaptcha.com")) return Response.json({ success: true, hostname: "joshuanguyen123.github.io" });
    if (String(url).includes("web3forms.com")) return Response.json({ success: true });
    throw new Error(`unexpected fetch ${url}`);
  };
  try {
    const response = await worker.fetch(new Request("https://admin.example/api/contact", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
      body: JSON.stringify({ name: "Joshua", email: "joshua@example.com", message: "Hello", captchaToken: "c".repeat(32) }),
    }), env);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { sent: true });
    assert.equal(calls.length, 2);
    assert.match(calls[0].init.body.toString(), /secret=captcha-secret/);
    assert.match(calls[1].init.body, /relay-secret/);
  } finally { globalThis.fetch = originalFetch; }
});

test("admin writes reject bodies above the bounded request size", async () => {
  const oversized = await worker.fetch(apiRequest("/api/posts/safe-post", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ source: "x".repeat(120_001) }),
  }), environment());
  assert.equal(oversized.status, 413);
});

const CR = String.fromCharCode(13);
const LF = String.fromCharCode(10);
const NUL = String.fromCharCode(0);

function contactRequest(env, payload) {
  return worker.fetch(new Request("https://admin.example/api/contact", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "CF-Connecting-IP": "192.0.2.1" },
    body: JSON.stringify({ name: "Joshua", email: "joshua@example.com", message: "Hello", captchaToken: "c".repeat(32), ...payload }),
  }), env);
}

function stubContactUpstreams(onRelay) {
  return async (url, init) => {
    if (String(url).includes("hcaptcha.com")) return Response.json({ success: true, hostname: "joshuanguyen123.github.io" });
    if (String(url).includes("web3forms.com")) {
      onRelay(JSON.parse(init.body));
      return Response.json({ success: true });
    }
    throw new Error(`unexpected fetch ${url}`);
  };
}

test("the contact relay refuses control characters and collapses newlines", async () => {
  const env = configuredEnvironment();
  const originalFetch = globalThis.fetch;
  let relayed = null;
  globalThis.fetch = stubContactUpstreams((body) => { relayed = body; });
  try {
    // A name carrying CRLF is how a submission smuggles extra lines into the
    // notification email the provider builds.
    const injected = await contactRequest(env, { name: `Josh${CR}${LF}Bcc: victim@example.com` });
    assert.equal(injected.status, 400);
    assert.equal(relayed, null, "an injected name must never reach the relay");

    assert.equal((await contactRequest(env, { email: "<script>alert(1)</script>x@b.co" })).status, 400);
    assert.equal((await contactRequest(env, { email: `a@b.co${NUL}` })).status, 400);
    assert.equal(relayed, null);

    const accepted = await contactRequest(env, { message: `One${CR}${LF}Two${NUL}Three` });
    assert.equal(accepted.status, 200);
    assert.equal(relayed.message, `One${LF}TwoThree`);
    assert.equal(relayed.name, "Joshua");
  } finally { globalThis.fetch = originalFetch; }
});

test("the unauthenticated contact relay is throttled before it reaches either upstream", async () => {
  const env = configuredEnvironment();
  const originalFetch = globalThis.fetch;
  let upstreamCalls = 0;
  globalThis.fetch = async (url, init) => { upstreamCalls += 1; return stubContactUpstreams(() => {})(url, init); };
  try {
    const seenKeys = [];
    env.CONTACT_RATE_LIMITER.limit = async ({ key }) => { seenKeys.push(key); return { success: false }; };
    const throttled = await contactRequest(env, {});
    assert.equal(throttled.status, 429);
    assert.equal(upstreamCalls, 0, "a throttled submission must not spend the Web3Forms quota");
    assert.match(seenKeys[0], /^contact:/);

    // A missing binding is a deployment fault, and must not read as throttling.
    delete env.CONTACT_RATE_LIMITER;
    const misconfigured = await contactRequest(env, {});
    assert.equal(misconfigured.status, 503);
    assert.match((await misconfigured.json()).error, /not configured/i);
    assert.equal(upstreamCalls, 0);
  } finally { globalThis.fetch = originalFetch; }
});

test("an OAuth state cannot be replayed once its callback has run", async () => {
  const env = configuredEnvironment();
  const login = await worker.fetch(new Request("https://admin.example/auth/login"), env);
  const state = new URL(login.headers.get("Location")).searchParams.get("state");
  const callback = `https://admin.example/auth/callback?code=abc&state=${encodeURIComponent(state)}`;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ error: "bad code" }, { status: 400 });
  try {
    assert.equal((await worker.fetch(new Request(callback), env)).status, 502);
    const replay = await worker.fetch(new Request(callback), env);
    assert.equal(replay.status, 400);
    assert.match((await replay.json()).error, /expired or invalid/i);
  } finally { globalThis.fetch = originalFetch; }
});

test("a private draft shadows a published post without discarding its sha", async () => {
  const env = environment();
  const source = `---${LF}slug: shadowed${LF}title: Shadowed${LF}summary: Summary${LF}publishedAt: 2026-08-24${LF}tags: ["test"]${LF}draft: true${LF}---${LF}${LF}Body${LF}`;
  await env.SESSIONS.put("draft:shadowed", JSON.stringify({ source, savedAt: "2026-08-24T00:00:00.000Z" }));
  const published = source.replace("draft: true", "draft: false");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    if (String(url).endsWith("content/blog?ref=main")) return Response.json([{ type: "file", name: "shadowed.md", path: "content/blog/shadowed.md" }]);
    return Response.json({ content: Buffer.from(published, "utf8").toString("base64"), sha: "b".repeat(40) });
  };
  try {
    const response = await worker.fetch(apiRequest("/api/posts"), env);
    assert.equal(response.status, 200);
    const [post] = (await response.json()).posts;
    assert.equal(post.slug, "shadowed");
    assert.equal(post.draft, true, "the private draft must win the merge");
    assert.equal(post.sha, "b".repeat(40), "losing the sha would make the post impossible to unpublish");
  } finally { globalThis.fetch = originalFetch; }
});
