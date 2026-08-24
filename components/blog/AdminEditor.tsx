"use client";

import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import { buildBlogSource } from "@/lib/blog/source-format.mjs";

const apiBase = process.env.NEXT_PUBLIC_BLOG_ADMIN_API_URL
  ?? "https://joshua-portfolio-blog-admin.personal-ai-digest.workers.dev";
const sessionKey = "portfolio-blog-admin-session";

type EditablePost = {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  tags: string[];
  draft: boolean;
  body: string;
  sha?: string;
};

const emptyPost = (): EditablePost => ({
  slug: "",
  title: "",
  summary: "",
  publishedAt: new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Denver",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()),
  tags: [],
  draft: true,
  body: "",
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function previewDocument(markdown: string) {
  const rendered = marked.parse(markdown) as string;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{color:#29241d;font:17px/1.65 Georgia,serif;margin:0;padding:24px}h1,h2,h3{font-family:Arial,sans-serif;line-height:1.25}pre{background:#221d16;color:#ece7db;overflow:auto;padding:16px}code{font-size:.85em}blockquote{border-left:2px solid #b8ad99;margin-left:0;padding-left:18px}img{max-width:100%}</style></head><body>${rendered}</body></html>`;
}

export function AdminEditor() {
  const [session, setSession] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [posts, setPosts] = useState<EditablePost[]>([]);
  const [post, setPost] = useState<EditablePost>(emptyPost);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [slugTouched, setSlugTouched] = useState(false);
  const preview = useMemo(() => previewDocument(post.body), [post.body]);

  const request = async (path: string, init: RequestInit = {}, activeSession = session) => {
    if (!activeSession) throw new Error("Sign in required");
    const response = await fetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${activeSession}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401) {
        sessionStorage.removeItem(sessionKey);
        setSession(null);
        setAuthState("signed-out");
      }
      throw new Error(body.error ?? `Request failed with HTTP ${response.status}`);
    }
    return body;
  };

  const loadPosts = async (activeSession = session) => {
    const result = await request("/api/posts", {}, activeSession);
    setPosts(result.posts);
    return result.posts as EditablePost[];
  };

  useEffect(() => {
    let cancelled = false;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const returnedSession = hash.get("session");
    if (returnedSession) {
      sessionStorage.setItem(sessionKey, returnedSession);
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }
    const activeSession = returnedSession ?? sessionStorage.getItem(sessionKey);
    const timer = window.setTimeout(() => {
      if (!activeSession) {
        setAuthState("signed-out");
        return;
      }
      setSession(activeSession);
      request("/api/me", {}, activeSession)
        .then(() => loadPosts(activeSession))
        .then(() => { if (!cancelled) setAuthState("signed-in"); })
        .catch((error) => {
          if (!cancelled) {
            setStatus(error.message);
            setAuthState("signed-out");
          }
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  // The initial authentication exchange must run once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const choosePost = (slug: string) => {
    if (!slug) {
      setPost(emptyPost());
      setSlugTouched(false);
      setStatus("");
      return;
    }
    const selected = posts.find((item) => item.slug === slug);
    if (selected) {
      setPost({ ...selected });
      setSlugTouched(true);
      setStatus("");
    }
  };

  const save = async (draft: boolean) => {
    setSaving(true);
    setStatus("");
    try {
      const next = { ...post, draft, tags: post.tags.map((tag) => tag.trim()).filter(Boolean) };
      const source = buildBlogSource(next, next.body);
      const result = await request(`/api/posts/${encodeURIComponent(next.slug)}`, {
        method: "PUT",
        body: JSON.stringify({ source, ...(next.sha ? { sha: next.sha } : {}) }),
      });
      const refreshed = await loadPosts();
      const saved = refreshed.find((item) => item.slug === next.slug) ?? result.post;
      setPost({ ...saved });
      setSlugTouched(true);
      setStatus(`${draft ? "Draft saved" : "Published"}. The site deployment has started.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The post could not be saved");
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    try { await request("/api/logout", { method: "POST", body: "{}" }); } catch { /* The local session is cleared either way. */ }
    sessionStorage.removeItem(sessionKey);
    setSession(null);
    setAuthState("signed-out");
    setPosts([]);
    setPost(emptyPost());
  };

  if (authState === "checking") return <section className="admin-auth"><p>Checking your editor session…</p>{status ? <p role="alert">{status}</p> : null}</section>;
  if (authState === "signed-out") return (
    <section className="admin-auth">
      <span className="eyebrow">Admin only</span>
      <h1>Write without opening the repository.</h1>
      <p>GitHub verifies your identity. The editor can only write blog Markdown, and every publish remains a normal reviewed commit on <code>main</code>.</p>
      <a className="primary-link" href={`${apiBase}/auth/login`}>Sign in with GitHub</a>
      {status ? <p className="admin-status" role="alert">{status}</p> : null}
    </section>
  );

  return (
    <section className="admin-editor" aria-label="Blog editor">
      <div className="admin-toolbar">
        <div>
          <span className="eyebrow">Signed in as JoshuaNguyen123</span>
          <h1>Blog editor</h1>
        </div>
        <button className="quiet-button" type="button" onClick={signOut}>Sign out</button>
      </div>

      <div className="admin-post-picker">
        <label htmlFor="admin-post">Post</label>
        <select id="admin-post" value={post.sha ? post.slug : ""} onChange={(event) => choosePost(event.target.value)}>
          <option value="">New post</option>
          {posts.map((item) => <option value={item.slug} key={item.slug}>{item.draft ? "Draft: " : ""}{item.title}</option>)}
        </select>
      </div>

      <div className="admin-edit-grid">
        <form className="admin-form" onSubmit={(event) => event.preventDefault()}>
          <label>Title<input value={post.title} maxLength={160} onChange={(event) => {
            const title = event.target.value;
            setPost((current) => ({ ...current, title, slug: current.sha || slugTouched ? current.slug : slugify(title) }));
          }} /></label>
          <label>Slug<input value={post.slug} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" onChange={(event) => { setSlugTouched(true); setPost((current) => ({ ...current, slug: event.target.value })); }} /></label>
          <label>Summary<textarea value={post.summary} maxLength={320} rows={3} onChange={(event) => setPost((current) => ({ ...current, summary: event.target.value }))} /></label>
          <div className="admin-field-row">
            <label>Publication date<input type="date" value={post.publishedAt} onChange={(event) => setPost((current) => ({ ...current, publishedAt: event.target.value }))} /></label>
            <label>Tags<input value={post.tags.join(", ")} placeholder="agents, privacy" onChange={(event) => setPost((current) => ({ ...current, tags: event.target.value.split(",") }))} /></label>
          </div>
          <label>Markdown<textarea className="admin-markdown" value={post.body} rows={24} spellCheck onChange={(event) => setPost((current) => ({ ...current, body: event.target.value }))} /></label>
          <div className="admin-actions">
            <button className="quiet-button" type="button" disabled={saving} onClick={() => save(true)}>Save draft</button>
            <button className="primary-button" type="button" disabled={saving} onClick={() => save(false)}>{saving ? "Saving…" : "Publish"}</button>
          </div>
          {status ? <p className="admin-status" role="status">{status}</p> : null}
        </form>
        <div className="admin-preview">
          <span className="eyebrow">Preview</span>
          <iframe title="Markdown preview" sandbox="" srcDoc={preview} />
        </div>
      </div>
    </section>
  );
}
