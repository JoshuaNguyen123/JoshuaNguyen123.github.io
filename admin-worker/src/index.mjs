import { isBlogSlug, parseBlogSource } from "../../lib/blog/source-format.mjs";

const ADMIN_LOGIN = "JoshuaNguyen123";
const REPOSITORY = "JoshuaNguyen123/JoshuaNguyen123.github.io";
const BRANCH = "main";
const SITE_ORIGIN = "https://joshuanguyen123.github.io";
const API_VERSION = "2022-11-28";
const SESSION_SECONDS = 8 * 60 * 60;
const STATE_SECONDS = 10 * 60;
const MAX_REQUEST_BYTES = 120_000;
const ALLOWED_ORIGINS = new Set([SITE_ORIGIN]);
// Loopback origins are opt-in. hCaptcha site keys usually allow localhost for
// development, so leaving these on in production would let anyone serving a
// page from their own machine mint a token this worker accepts.
const DEVELOPMENT_ORIGINS = new Set(["http://localhost:3000", "http://127.0.0.1:3000"]);
const EMAIL_PATTERN = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

// Web3Forms builds the notification email out of these fields, so control
// characters must not survive the relay: interior CR/LF in a name or address
// is how a submission smuggles extra lines into whatever the provider sends.
function hasControlCharacters(value) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

// A message legitimately contains newlines and tabs, and nothing else below 0x20.
function normalizeMessage(value) {
  const newline = String.fromCharCode(10);
  let result = "";
  let afterCarriageReturn = false;
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 0x0d) {
      result += newline;
      afterCarriageReturn = true;
      continue;
    }
    // A CRLF pair is one line break, not two.
    if (code === 0x0a) {
      if (!afterCarriageReturn) result += newline;
    } else if (code >= 0x20 || code === 0x09) {
      result += character;
    }
    afterCarriageReturn = false;
  }
  return result.trim();
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlEncode(value) {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8_192) binary += String.fromCharCode(...bytes.subarray(index, index + 8_192));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function base64UrlDecode(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

// The OAuth client secret is also POSTed to GitHub during the token exchange,
// so it is never used as a signing key directly: HKDF derives a separate
// subkey whose only purpose is signing state.
async function stateKey(secret, usages) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: new Uint8Array(0),
      info: new TextEncoder().encode("portfolio-admin/oauth-state/v1"),
    },
    material,
    { name: "HMAC", hash: "SHA-256", length: 256 },
    false,
    usages,
  );
}

async function createOAuthState(secret, now = Date.now()) {
  const payload = base64UrlEncode(JSON.stringify({ issuedAt: now, nonce: randomToken() }));
  const signature = await crypto.subtle.sign("HMAC", await stateKey(secret, ["sign"]), new TextEncoder().encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(signature))}`;
}

// Returns the signed payload so the caller can retire the nonce, or null when
// the state is malformed, expired, or not ours.
async function readOAuthState(value, secret, now = Date.now()) {
  const match = /^([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]{43})$/.exec(value);
  if (!match) return null;
  let parsed;
  try { parsed = JSON.parse(new TextDecoder().decode(base64UrlDecode(match[1]))); } catch { return null; }
  if (!Number.isInteger(parsed?.issuedAt) || typeof parsed?.nonce !== "string") return null;
  if (parsed.issuedAt > now + 60_000 || now - parsed.issuedAt > STATE_SECONDS * 1_000) return null;
  try {
    // Awaited inside the try so a rejected verification is caught here rather
    // than escaping as an unhandled worker error.
    const valid = await crypto.subtle.verify(
      "HMAC",
      await stateKey(secret, ["verify"]),
      base64UrlDecode(match[2]),
      new TextEncoder().encode(match[1]),
    );
    return valid ? parsed : null;
  } catch {
    return null;
  }
}

async function verifyOAuthState(value, secret, now = Date.now()) {
  return Boolean(await readOAuthState(value, secret, now));
}

const RATE_LIMIT_OK = "ok";
const RATE_LIMIT_THROTTLED = "throttled";
const RATE_LIMIT_UNAVAILABLE = "unavailable";

// An IPv6 host is handed an entire /64 at no cost, so the routing prefix rather
// than the exact address identifies the actor.
function rateLimitActor(request) {
  const address = request.headers.get("CF-Connecting-IP") ?? "unknown";
  return address.includes(":") ? address.split(":").slice(0, 4).join(":") : address;
}

// Rate limiting fails closed, but a missing or throwing binding is a deployment
// fault rather than an abusive client. Reporting both as 429 would make a
// mis-provisioned namespace indistinguishable from genuine throttling and lock
// the owner out of the editor with no way to tell which had happened.
async function rateLimit(request, binding, purpose) {
  if (!binding?.limit) return RATE_LIMIT_UNAVAILABLE;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rateLimitActor(request)));
  const key = `${purpose}:${base64UrlEncode(new Uint8Array(digest))}`;
  try {
    return (await binding.limit({ key })).success === true ? RATE_LIMIT_OK : RATE_LIMIT_THROTTLED;
  } catch {
    return RATE_LIMIT_UNAVAILABLE;
  }
}

function rateLimitRejection(verdict, origin = null) {
  if (verdict === RATE_LIMIT_OK) return null;
  return verdict === RATE_LIMIT_THROTTLED
    ? json({ error: "Too many requests. Wait a minute and try again." }, 429, origin)
    : json({ error: "Rate limiting is not configured" }, 503, origin);
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

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  if (!origin) return null;
  if (ALLOWED_ORIGINS.has(origin)) return origin;
  return env?.ALLOW_LOCAL_ORIGINS === "1" && DEVELOPMENT_ORIGINS.has(origin) ? origin : null;
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
  const throttled = rateLimitRejection(await rateLimit(request, env.AUTH_START_RATE_LIMITER, "start"));
  if (throttled) return throttled;
  const state = await createOAuthState(env.GITHUB_CLIENT_SECRET);
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
  const stateRecord = code ? await readOAuthState(state, env.GITHUB_CLIENT_SECRET) : null;
  if (!stateRecord) return json({ error: "GitHub authorization expired or invalid" }, 400);
  const throttled = rateLimitRejection(await rateLimit(request, env.AUTH_CALLBACK_RATE_LIMITER, "callback"));
  if (throttled) return throttled;
  // Single use: a signed state that has already reached the callback must not
  // stay replayable for the remainder of its ten-minute window.
  const usedStateKey = `state-used:${stateRecord.nonce}`;
  if (await env.SESSIONS.get(usedStateKey)) return json({ error: "GitHub authorization expired or invalid" }, 400);
  await env.SESSIONS.put(usedStateKey, "1", { expirationTtl: STATE_SECONDS });

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

async function listPrivateDrafts(env) {
  const keys = [];
  let cursor;
  do {
    const page = await env.SESSIONS.list({ prefix: "draft:", ...(cursor ? { cursor } : {}) });
    keys.push(...page.keys);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return Promise.all(keys.map(async ({ name }) => {
    const raw = await env.SESSIONS.get(name);
    if (!raw) return null;
    const record = JSON.parse(raw);
    if (typeof record.source !== "string") throw new Error("Private draft is invalid");
    const parsed = parseBlogSource(record.source);
    if (!parsed.metadata.draft || name !== `draft:${parsed.metadata.slug}`) throw new Error("Private draft is invalid");
    return { ...parsed.metadata, body: parsed.body, stored: true };
  })).then((drafts) => drafts.filter(Boolean));
}

async function listPosts(token, env) {
  const listing = await github(`/repos/${REPOSITORY}/contents/content/blog?ref=${BRANCH}`, token);
  if (!listing.response.ok || !Array.isArray(listing.body)) return json({ error: "Could not list blog posts" }, listing.response.status || 502);
  const files = listing.body.filter((item) => item.type === "file" && /^[a-z0-9][a-z0-9-]*\.md$/.test(item.name));
  const posts = await Promise.all(files.map(async (file) => {
    const result = await github(`/repos/${REPOSITORY}/contents/${file.path}?ref=${BRANCH}`, token);
    if (!result.response.ok || !result.body?.content || !result.body?.sha) throw new Error(`Could not read ${file.name}`);
    const source = decodeContent(result.body.content);
    const parsed = parseBlogSource(source);
    if (parsed.metadata.draft) throw new Error(`${file.name} is a public-repository draft`);
    return { ...parsed.metadata, body: parsed.body, sha: result.body.sha, stored: true };
  }));
  const drafts = await listPrivateDrafts(env);
  const merged = new Map(posts.map((post) => [post.slug, post]));
  // A private draft shadows a published file of the same slug, but it must not
  // erase that file's sha: without it the editor cannot unpublish, and the
  // unpublish path would report success while leaving the post on the site.
  for (const draft of drafts) merged.set(draft.slug, { ...merged.get(draft.slug), ...draft });
  const mergedPosts = [...merged.values()].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
  return { posts: mergedPosts };
}

async function savePost(request, token, slug, env) {
  if (!isBlogSlug(slug)) return { error: "Invalid post slug", status: 400 };
  const decoded = await readJsonLimited(request);
  if (decoded.tooLarge) return { error: "Post request is too large", status: 413 };
  const payload = decoded.value;
  if (!payload || typeof payload.source !== "string" || (payload.sha !== undefined && !/^[0-9a-f]{40}$/i.test(payload.sha))) return { error: "Post request is invalid", status: 400 };
  let parsed;
  try { parsed = parseBlogSource(payload.source); } catch (error) { return { error: error.message, status: 400 }; }
  if (parsed.metadata.slug !== slug) return { error: "Post slug does not match its file path", status: 400 };
  const path = `content/blog/${slug}.md`;
  const privateDraftKey = `draft:${slug}`;
  if (parsed.metadata.draft) {
    await env.SESSIONS.put(privateDraftKey, JSON.stringify({ source: payload.source, savedAt: new Date().toISOString() }));
    if (payload.sha) {
      const removal = await github(`/repos/${REPOSITORY}/contents/${path}`, token, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: `Unpublish post: ${parsed.metadata.title}`, sha: payload.sha, branch: BRANCH }),
      });
      if (!removal.response.ok) {
        await env.SESSIONS.delete(privateDraftKey);
        const status = [409, 422].includes(removal.response.status) ? 409 : removal.response.status || 502;
        return { error: status === 409 ? "The post changed since it was opened. Reload before unpublishing." : "GitHub could not unpublish the post", status };
      }
    }
    return { post: { ...parsed.metadata, body: parsed.body, stored: true }, commitUrl: null };
  }
  const body = {
    message: `Publish post: ${parsed.metadata.title}`,
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
  await env.SESSIONS.delete(privateDraftKey);
  return {
    post: { ...parsed.metadata, body: parsed.body, sha: result.body?.content?.sha, stored: true },
    commitUrl: result.body?.commit?.html_url ?? null,
  };
}

function validContactPayload(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort().join(",");
  if (keys !== "captchaToken,email,message,name") return false;
  return typeof value.name === "string" && value.name.trim().length >= 1 && value.name.length <= 120 && !hasControlCharacters(value.name)
    && typeof value.email === "string" && value.email.length <= 320 && EMAIL_PATTERN.test(value.email)
    && typeof value.message === "string" && normalizeMessage(value.message).length >= 1 && value.message.length <= 10_000
    && typeof value.captchaToken === "string" && value.captchaToken.length >= 20 && value.captchaToken.length <= 4_096;
}

async function handleContact(request, env) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: "Origin not allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    },
  });
  if (request.method !== "POST") return json({ error: "Not found" }, 404, origin);
  if (!env.HCAPTCHA_SECRET || !env.WEB3FORMS_ACCESS_KEY) return json({ error: "Contact form is unavailable" }, 503, origin);
  // The only unauthenticated write path on this worker. A captcha raises the
  // cost of a submission but is not a rate limit, so throttle before the body
  // is buffered and before either upstream call is made.
  const throttled = rateLimitRejection(await rateLimit(request, env.CONTACT_RATE_LIMITER, "contact"), origin);
  if (throttled) return throttled;
  const decoded = await readJsonLimited(request);
  if (decoded.tooLarge) return json({ error: "Contact request is too large" }, 413, origin);
  if (!validContactPayload(decoded.value)) return json({ error: "Contact request is invalid" }, 400, origin);

  const verification = await fetch("https://api.hcaptcha.com/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: env.HCAPTCHA_SECRET,
      response: decoded.value.captchaToken,
      remoteip: request.headers.get("CF-Connecting-IP") ?? "",
      // Without this, a token minted against any other site key on the same
      // hCaptcha account would verify here.
      ...(env.HCAPTCHA_SITE_KEY ? { sitekey: env.HCAPTCHA_SITE_KEY } : {}),
    }),
  });
  const verified = await verification.json().catch(() => null);
  const expectedHostname = new URL(origin).hostname;
  if (!verification.ok || verified?.success !== true || verified?.hostname !== expectedHostname) return json({ error: "Captcha verification failed" }, 400, origin);

  const relay = await fetch("https://api.web3forms.com/submit", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      access_key: env.WEB3FORMS_ACCESS_KEY,
      subject: "New message from joshuanguyen123.github.io",
      from_name: "Portfolio contact form",
      name: decoded.value.name.trim(),
      email: decoded.value.email.trim(),
      message: normalizeMessage(decoded.value.message),
    }),
  });
  const relayBody = await relay.json().catch(() => null);
  if (!relay.ok || relayBody?.success !== true) return json({ error: "Contact message could not be delivered" }, 502, origin);
  return json({ sent: true }, 200, origin);
}

async function handleApi(request, env) {
  const origin = allowedOrigin(request, env);
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
      const result = await listPosts(auth.session.accessToken, env);
      return result instanceof Response ? json(await result.json(), result.status, origin) : json(result, 200, origin);
    } catch {
      return json({ error: "One or more blog posts failed validation" }, 502, origin);
    }
  }
  if (url.pathname.startsWith("/api/posts/") && request.method === "PUT") {
    let slug;
    try { slug = decodeURIComponent(url.pathname.slice("/api/posts/".length)); } catch { return json({ error: "Invalid post slug" }, 400, origin); }
    const result = await savePost(request, auth.session.accessToken, slug, env);
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
    if (url.pathname === "/api/contact") return handleContact(request, env);
    if (url.pathname.startsWith("/api/")) return handleApi(request, env);
    if (url.pathname === "/health" && request.method === "GET") return json({
      ok: true,
      adminConfigured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET && env.OAUTH_CALLBACK_URL),
      contactConfigured: Boolean(env.HCAPTCHA_SECRET && env.WEB3FORMS_ACCESS_KEY),
    });
    return json({ error: "Not found" }, 404);
  },
};

export { ADMIN_LOGIN, ALLOWED_ORIGINS, REPOSITORY, createOAuthState, savePost, verifyOAuthState };
