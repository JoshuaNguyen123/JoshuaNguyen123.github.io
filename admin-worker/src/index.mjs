import { isBlogSlug, parseBlogSource } from "../../lib/blog/source-format.mjs";

const ADMIN_LOGIN = "JoshuaNguyen123";
const REPOSITORY = "JoshuaNguyen123/JoshuaNguyen123.github.io";
const BRANCH = "main";
const SITE_ORIGIN = "https://joshuanguyen123.github.io";
const API_VERSION = "2022-11-28";
const SESSION_SECONDS = 8 * 60 * 60;
const STATE_SECONDS = 10 * 60;
const LOGIN_COOLDOWN_SECONDS = 10;
const LOGIN_COOLDOWN_STORAGE_SECONDS = 60;
const MAX_REQUEST_BYTES = 120_000;
const ALLOWED_ORIGINS = new Set([SITE_ORIGIN, "http://localhost:3000", "http://127.0.0.1:3000"]);

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function json(body, status = 200, origin = null) {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  });
  if (origin) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Allow-Methods", "GET, PUT, POST, OPTIONS");
    headers.set("Vary", "Origin");
  }
  return new Response(JSON.stringify(body), { status, headers });
}

function redirect(location, status = 302) {
  return new Response(null, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Location: location,
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function allowedOrigin(request) {
  const origin = request.headers.get("Origin");
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

async function github(path, token, init = {}) {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "User-Agent": "joshua-portfolio-blog-admin/1.0",
      "X-GitHub-Api-Version": API_VERSION,
      ...(init.headers ?? {}),
    },
  });
  const body = response.status === 204 ? null : await response.json().catch(() => null);
  return { response, body };
}

async function revokeGithubToken(env, token) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !token) return;
  const credentials = btoa(`${env.GITHUB_CLIENT_ID}:${env.GITHUB_CLIENT_SECRET}`);
  await fetch(`https://api.github.com/applications/${encodeURIComponent(env.GITHUB_CLIENT_ID)}/token`, {
    method: "DELETE",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
      "User-Agent": "joshua-portfolio-blog-admin/1.0",
      "X-GitHub-Api-Version": API_VERSION,
    },
    body: JSON.stringify({ access_token: token }),
  }).catch(() => null);
}

async function requestFingerprint(request) {
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(address));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function readJsonLimited(request) {
  const declaredLength = Number(request.headers.get("Content-Length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) return { tooLarge: true };
  if (!request.body) return { value: null };
  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return { tooLarge: true };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  try { return { value: JSON.parse(text) }; } catch { return { value: null }; }
}

function decodeContent(value) {
  const binary = atob(String(value).replaceAll("\n", ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function encodeContent(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8_192) binary += String.fromCharCode(...bytes.subarray(index, index + 8_192));
  return btoa(binary);
}

async function requireSession(request, env, origin) {
  const header = request.headers.get("Authorization") ?? "";
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/.exec(header);
  if (!match) return { error: json({ error: "Sign in required" }, 401, origin) };
  const key = `session:${match[1]}`;
  const raw = await env.SESSIONS.get(key);
  if (!raw) return { error: json({ error: "Session expired" }, 401, origin) };
  let session;
  try { session = JSON.parse(raw); } catch { return { error: json({ error: "Session invalid" }, 401, origin) }; }
  if (session.login !== ADMIN_LOGIN || typeof session.accessToken !== "string") return { error: json({ error: "Session invalid" }, 401, origin) };
  return { key, session };
}

async function startLogin(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.OAUTH_CALLBACK_URL) return json({ error: "Admin authentication is not configured" }, 503);
  const fingerprint = await requestFingerprint(request);
  const throttleKey = `login-cooldown:${fingerprint}`;
  const lastAttempt = Number(await env.SESSIONS.get(throttleKey));
  if (Number.isFinite(lastAttempt) && Date.now() - lastAttempt < LOGIN_COOLDOWN_SECONDS * 1_000) return json({ error: "Please wait a few seconds before trying to sign in again" }, 429);
  await env.SESSIONS.put(throttleKey, String(Date.now()), { expirationTtl: LOGIN_COOLDOWN_STORAGE_SECONDS });
  const state = randomToken();
  await env.SESSIONS.put(`oauth:${state}`, JSON.stringify({ createdAt: Date.now() }), { expirationTtl: STATE_SECONDS });
  const authorization = new URL("https://github.com/login/oauth/authorize");
  authorization.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authorization.searchParams.set("redirect_uri", env.OAUTH_CALLBACK_URL);
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("login", ADMIN_LOGIN);
  authorization.searchParams.set("allow_signup", "false");
  return redirect(authorization.toString());
}

async function finishLogin(request, env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.OAUTH_CALLBACK_URL) return json({ error: "Admin authentication is not configured" }, 503);
  const url = new URL(request.url);
  const state = url.searchParams.get("state") ?? "";
  const code = url.searchParams.get("code") ?? "";
  if (!/^[A-Za-z0-9_-]{20,}$/.test(state) || !code) return json({ error: "GitHub authorization response was invalid" }, 400);
  const stateKey = `oauth:${state}`;
  const pending = await env.SESSIONS.get(stateKey);
  await env.SESSIONS.delete(stateKey);
  if (!pending) return json({ error: "GitHub authorization expired or was already used" }, 400);

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: env.OAUTH_CALLBACK_URL,
    }),
  });
  const tokenBody = await tokenResponse.json().catch(() => null);
  if (!tokenResponse.ok || !tokenBody?.access_token) return json({ error: "GitHub token exchange failed" }, 502);

  const [{ response: userResponse, body: user }, { response: repoResponse, body: repo }] = await Promise.all([
    github("/user", tokenBody.access_token),
    github(`/repos/${REPOSITORY}`, tokenBody.access_token),
  ]);
  const permitted = userResponse.ok && repoResponse.ok
    && String(user?.login).toLowerCase() === ADMIN_LOGIN.toLowerCase()
    && (repo?.permissions?.push === true || repo?.permissions?.admin === true);
  if (!permitted) {
    await revokeGithubToken(env, tokenBody.access_token);
    return json({ error: "This GitHub account is not authorized to edit the portfolio" }, 403);
  }

  const sessionId = randomToken();
  const ttl = Math.max(60, Math.min(SESSION_SECONDS, Number(tokenBody.expires_in) || SESSION_SECONDS));
  await env.SESSIONS.put(`session:${sessionId}`, JSON.stringify({ login: ADMIN_LOGIN, accessToken: tokenBody.access_token }), { expirationTtl: ttl });
  return redirect(`${SITE_ORIGIN}/admin/#session=${encodeURIComponent(sessionId)}`);
}

async function listPosts(token) {
  const listing = await github(`/repos/${REPOSITORY}/contents/content/blog?ref=${BRANCH}`, token);
  if (!listing.response.ok || !Array.isArray(listing.body)) return json({ error: "Could not list blog posts" }, listing.response.status || 502);
  const files = listing.body.filter((item) => item.type === "file" && /^[a-z0-9][a-z0-9-]*\.md$/.test(item.name));
  const posts = await Promise.all(files.map(async (file) => {
    const result = await github(`/repos/${REPOSITORY}/contents/${file.path}?ref=${BRANCH}`, token);
    if (!result.response.ok || !result.body?.content || !result.body?.sha) throw new Error(`Could not read ${file.name}`);
    const source = decodeContent(result.body.content);
    const parsed = parseBlogSource(source);
    return { ...parsed.metadata, body: parsed.body, sha: result.body.sha };
  }));
  posts.sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  return { posts };
}

async function savePost(request, token, slug) {
  if (!isBlogSlug(slug)) return { error: "Invalid post slug", status: 400 };
  const decoded = await readJsonLimited(request);
  if (decoded.tooLarge) return { error: "Post request is too large", status: 413 };
  const payload = decoded.value;
  if (!payload || typeof payload.source !== "string" || (payload.sha !== undefined && typeof payload.sha !== "string")) return { error: "Post request is invalid", status: 400 };
  let parsed;
  try { parsed = parseBlogSource(payload.source); } catch (error) { return { error: error.message, status: 400 }; }
  if (parsed.metadata.slug !== slug) return { error: "Post slug does not match its file path", status: 400 };
  const path = `content/blog/${slug}.md`;
  const body = {
    message: `${parsed.metadata.draft ? "Save draft" : "Publish post"}: ${parsed.metadata.title}`,
    content: encodeContent(payload.source),
    branch: BRANCH,
    ...(payload.sha ? { sha: payload.sha } : {}),
  };
  const result = await github(`/repos/${REPOSITORY}/contents/${path}`, token, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!result.response.ok) {
    const status = [409, 422].includes(result.response.status) ? 409 : result.response.status || 502;
    return { error: status === 409 ? "The post changed since it was opened. Reload before saving." : "GitHub could not save the post", status };
  }
  return {
    post: { ...parsed.metadata, body: parsed.body, sha: result.body?.content?.sha },
    commitUrl: result.body?.commit?.html_url ?? null,
  };
}

async function handleApi(request, env) {
  const origin = allowedOrigin(request);
  if (!origin) return json({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, PUT, POST, OPTIONS",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
  const auth = await requireSession(request, env, origin);
  if (auth.error) return auth.error;
  const url = new URL(request.url);

  if (url.pathname === "/api/me" && request.method === "GET") return json({ login: ADMIN_LOGIN }, 200, origin);
  if (url.pathname === "/api/posts" && request.method === "GET") {
    try {
      const result = await listPosts(auth.session.accessToken);
      return result instanceof Response ? json(await result.json(), result.status, origin) : json(result, 200, origin);
    } catch {
      return json({ error: "One or more blog posts failed validation" }, 502, origin);
    }
  }
  if (url.pathname.startsWith("/api/posts/") && request.method === "PUT") {
    let slug;
    try { slug = decodeURIComponent(url.pathname.slice("/api/posts/".length)); } catch { return json({ error: "Invalid post slug" }, 400, origin); }
    const result = await savePost(request, auth.session.accessToken, slug);
    return json(result.status ? { error: result.error } : result, result.status ?? 200, origin);
  }
  if (url.pathname === "/api/logout" && request.method === "POST") {
    await env.SESSIONS.delete(auth.key);
    await revokeGithubToken(env, auth.session.accessToken);
    return json({ signedOut: true }, 200, origin);
  }
  return json({ error: "Not found" }, 404, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/auth/login" && request.method === "GET") return startLogin(request, env);
    if (url.pathname === "/auth/callback" && request.method === "GET") return finishLogin(request, env);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    if (url.pathname === "/health" && request.method === "GET") return json({ ok: true, configured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.OAUTH_CALLBACK_URL) });
    return json({ error: "Not found" }, 404);
  },
};

export { ADMIN_LOGIN, ALLOWED_ORIGINS, REPOSITORY, savePost };
