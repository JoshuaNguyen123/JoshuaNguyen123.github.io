"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { marked } from "marked";
import { buildBlogSource } from "@/lib/blog/source-format.mjs";

const apiBase = process.env.NEXT_PUBLIC_BLOG_ADMIN_API_URL
  ?? "https://joshua-portfolio-blog-admin.personal-ai-digest.workers.dev";
const siteOrigin = "https://joshuanguyen123.github.io";
const sessionKey = "portfolio-blog-admin-session";
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

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

const today = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Denver",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());

const emptyPost = (): EditablePost => ({
  slug: "",
  title: "",
  summary: "",
  publishedAt: today(),
  tags: [],
  draft: true,
  body: "",
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function readableDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", year: "numeric", month: "long", day: "numeric",
  }).format(new Date(`${value}T12:00:00Z`));
}

/* The worker validates frontmatter and rejects the whole save with one message.
   Checking the same rules here turns that into a list you can fix before saving. */
function describeIssues(post: EditablePost, tags: string[]) {
  const issues: string[] = [];
  if (!post.title.trim()) issues.push("Give the post a title.");
  else if (post.title.length > 160) issues.push("Shorten the title to 160 characters or fewer.");
  if (!slugPattern.test(post.slug)) issues.push("Add a web address under Post settings.");
  if (!post.summary.trim()) issues.push("Write the standfirst line under the title.");
  else if (post.summary.length > 320) issues.push("Shorten the standfirst to 320 characters or fewer.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(post.publishedAt)) issues.push("Choose a publication date.");
  if (!tags.length) issues.push("Add at least one tag above the title.");
  else if (tags.length > 8) issues.push("Use at most 8 tags.");
  return issues;
}

function previewDocument(markdown: string) {
  const rendered = marked.parse(markdown || "*Nothing written yet.*") as string;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"><style>body{color:#3a352c;font:19px/1.72 Georgia,serif;margin:0;padding:0}h1,h2,h3{color:#16130e;font-weight:500;letter-spacing:-.015em;line-height:1.25}h2{font-size:25px;margin:1.9em 0 .5em}h3{font-size:21px}p{margin:1.1em 0}a{color:inherit;text-decoration:underline;text-underline-offset:3px}pre{background:#221d16;color:#ece7db;font-size:13px;overflow:auto;padding:22px}code{font-size:.75em}blockquote{border-left:2px solid #e6e1d5;font-size:21px;font-style:italic;margin:1.8em 0;padding-left:24px}img{max-width:100%}hr{border:0;border-top:1px solid #e6e1d5;margin:2.6em 0}</style></head><body>${rendered}</body></html>`;
}

/** Keeps a textarea exactly as tall as its text so the page scrolls, not the box. */
function useAutoHeight(value: string, enabled = true) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || !enabled) return;
    // With no laid-out width every character wraps to its own line, so
    // scrollHeight balloons and feeds a larger value back on each pass.
    // Skip until the element actually has a box to measure.
    if (!element.clientWidth) return;
    element.style.height = "auto";
    element.style.height = `${element.scrollHeight}px`;
  }, [value, enabled]);
  return ref;
}

export function AdminEditor() {
  const [session, setSession] = useState<string | null>(null);
  const [authState, setAuthState] = useState<"checking" | "signed-out" | "signed-in">("checking");
  const [posts, setPosts] = useState<EditablePost[]>([]);
  const [post, setPost] = useState<EditablePost>(emptyPost);
  const [tagsInput, setTagsInput] = useState("");
  const [baseline, setBaseline] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);

  const tags = useMemo(
    () => tagsInput.split(",").map((tag) => tag.trim()).filter(Boolean),
    [tagsInput],
  );
  const preview = useMemo(() => previewDocument(post.body), [post.body]);
  const issues = useMemo(() => describeIssues(post, tags), [post, tags]);
  const fingerprint = useMemo(() => JSON.stringify({ ...post, sha: undefined, tagsInput }), [post, tagsInput]);
  const dirty = baseline !== "" && fingerprint !== baseline;
  const isNew = !post.sha;

  const titleRef = useAutoHeight(post.title, !previewing);
  const bodyRef = useAutoHeight(post.body, !previewing);
  const summaryRef = useAutoHeight(post.summary, !previewing);

  const openPost = (source: EditablePost) => {
    const next = { ...source };
    const nextTags = source.tags.join(", ");
    setPost(next);
    setTagsInput(nextTags);
    setBaseline(JSON.stringify({ ...next, sha: undefined, tagsInput: nextTags }));
    setPreviewing(false);
    setSettingsOpen(false);
    setStatus("");
    setFailed(false);
  };

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
        .then(() => {
          if (cancelled) return;
          setAuthState("signed-in");
          openPost(emptyPost());
        })
        .catch((error) => {
          if (cancelled) return;
          setStatus(error.message);
          setFailed(true);
          setAuthState("signed-out");
        });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  // The initial authentication exchange must run once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Nothing is stored until a save commits, so leaving mid-edit loses the text.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const startNewPost = () => {
    if (dirty && !window.confirm("Discard the unsaved changes to this post?")) return;
    openPost(emptyPost());
  };

  const choosePost = (slug: string) => {
    if (slug === post.slug && !isNew) return;
    if (dirty && !window.confirm("Discard the unsaved changes to this post?")) return;
    const selected = posts.find((item) => item.slug === slug);
    if (selected) openPost(selected);
  };

  const save = async (draft: boolean) => {
    if (issues.length) {
      setPreviewing(false);
      if (issues.some((issue) => issue.includes("web address") || issue.includes("publication date"))) setSettingsOpen(true);
      setStatus("Finish the highlighted details before saving.");
      setFailed(true);
      return;
    }
    setSaving(true);
    setStatus("");
    setFailed(false);
    try {
      const next = { ...post, draft, tags };
      const source = buildBlogSource(next, next.body);
      const result = await request(`/api/posts/${encodeURIComponent(next.slug)}`, {
        method: "PUT",
        body: JSON.stringify({ source, ...(next.sha ? { sha: next.sha } : {}) }),
      });
      const refreshed = await loadPosts();
      openPost(refreshed.find((item) => item.slug === next.slug) ?? result.post);
      setStatus(draft
        ? "Draft saved. It stays private until you publish it."
        : "Published. The site rebuilds in about a minute.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "The post could not be saved");
      setFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const signOut = async () => {
    if (dirty && !window.confirm("Discard the unsaved changes to this post?")) return;
    try { await request("/api/logout", { method: "POST", body: "{}" }); } catch { /* The local session is cleared either way. */ }
    sessionStorage.removeItem(sessionKey);
    setSession(null);
    setAuthState("signed-out");
    setPosts([]);
    openPost(emptyPost());
  };

  if (authState === "checking") return (
    <section className="admin-auth"><p>Checking your editor session…</p></section>
  );

  if (authState === "signed-out") return (
    <section className="admin-auth">
      <span className="eyebrow">Admin only</span>
      <h1>Write without opening the repository.</h1>
      <p>GitHub verifies your identity. The editor can only write blog Markdown, and every publish remains a normal reviewed commit on <code>main</code>.</p>
      <a className="primary-link" href={`${apiBase}/auth/login`}>Sign in with GitHub</a>
      {status ? <p className="admin-status is-error" role="alert">{status}</p> : null}
    </section>
  );

  const drafts = posts.filter((item) => item.draft);
  const published = posts.filter((item) => !item.draft);

  const postButton = (item: EditablePost) => (
    <li key={item.slug}>
      <button
        type="button"
        className={`admin-post-item${item.slug === post.slug && !isNew ? " is-active" : ""}`}
        aria-current={item.slug === post.slug && !isNew ? "true" : undefined}
        onClick={() => choosePost(item.slug)}
      >
        <span className="admin-post-item-title">{item.title || "Untitled"}</span>
        <span className="admin-post-item-meta">{readableDate(item.publishedAt)}</span>
      </button>
    </li>
  );

  return (
    <section className="admin-editor" aria-label="Blog editor">
      <div className="admin-layout">
        <aside className="admin-sidebar" aria-label="Your posts">
          <button className="primary-button admin-new" type="button" onClick={startNewPost}>
            + New post
          </button>

          {posts.length === 0 ? (
            <p className="admin-sidebar-empty">No posts yet. The button above starts your first one.</p>
          ) : null}

          {drafts.length ? (
            <div className="admin-post-group">
              <span className="eyebrow">Drafts · {drafts.length}</span>
              <ul>{drafts.map(postButton)}</ul>
            </div>
          ) : null}

          {published.length ? (
            <div className="admin-post-group">
              <span className="eyebrow">Published · {published.length}</span>
              <ul>{published.map(postButton)}</ul>
            </div>
          ) : null}

          <div className="admin-sidebar-foot">
            <button className="admin-quiet-link" type="button" onClick={signOut}>Sign out</button>
          </div>
        </aside>

        <div className="admin-main">
          <div className="admin-state-bar">
            <span className={`admin-badge${isNew ? "" : post.draft ? " is-draft" : " is-live"}`}>
              {isNew ? "New post" : post.draft ? "Draft" : "Published"}
            </span>
            {dirty ? <span className="admin-dirty">Unsaved changes</span> : null}
            <div className="admin-state-actions">
              {!isNew && !post.draft ? (
                <a className="admin-quiet-link" href={`${siteOrigin}/blog/${post.slug}/`} target="_blank" rel="noreferrer">
                  View on site ↗
                </a>
              ) : null}
              <button className="admin-quiet-link" type="button" onClick={() => setPreviewing((value) => !value)}>
                {previewing ? "Back to writing" : "Preview"}
              </button>
            </div>
          </div>

          {/* The writing surface mirrors the published article: same serif, same
              measure, same paper. Editing a post should feel like editing the page. */}
          <div className="admin-sheet">
            {previewing ? (
              <article className="admin-sheet-preview">
                <span className="eyebrow">{tags.join(" · ") || "No tags yet"}</span>
                <h1>{post.title || "Untitled"}</h1>
                <p className="admin-sheet-standfirst">{post.summary || "No standfirst yet."}</p>
                <div className="admin-sheet-byline">{readableDate(post.publishedAt)}</div>
                <iframe className="admin-preview-frame" title="Post preview" sandbox="" srcDoc={preview} />
              </article>
            ) : (
              <article className="admin-sheet-write">
                <input
                  className="admin-line admin-line-tags"
                  value={tagsInput}
                  placeholder="TAGS, COMMA SEPARATED"
                  aria-label="Tags"
                  onChange={(event) => setTagsInput(event.target.value)}
                />
                <textarea
                  className="admin-line admin-line-title"
                  value={post.title}
                  rows={1}
                  maxLength={160}
                  placeholder="Title"
                  aria-label="Title"
                  ref={titleRef}
                  onChange={(event) => {
                    const title = event.target.value.replace(/\n/g, "");
                    setPost((current) => ({
                      ...current,
                      title,
                      slug: current.sha ? current.slug : slugify(title),
                    }));
                  }}
                />
                <textarea
                  className="admin-line admin-line-standfirst"
                  value={post.summary}
                  rows={1}
                  maxLength={320}
                  placeholder="One line under the title, shown on the writing index."
                  aria-label="Standfirst summary"
                  ref={summaryRef}
                  onChange={(event) => setPost((current) => ({ ...current, summary: event.target.value.replace(/\n/g, "") }))}
                />
                <div className="admin-sheet-byline">
                  <input
                    className="admin-line admin-line-date"
                    type="date"
                    value={post.publishedAt}
                    aria-label="Publication date"
                    onChange={(event) => setPost((current) => ({ ...current, publishedAt: event.target.value }))}
                  />
                </div>
                <textarea
                  className="admin-line admin-line-body"
                  value={post.body}
                  rows={12}
                  spellCheck
                  placeholder="Start writing. Markdown works: ## for a heading, **bold**, [link](https://example.com)."
                  aria-label="Post body"
                  ref={bodyRef}
                  onChange={(event) => setPost((current) => ({ ...current, body: event.target.value }))}
                />
              </article>
            )}
          </div>

          {issues.length ? (
            <div className="admin-issues">
              <span className="eyebrow">Before this can be saved</span>
              <ul>{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
            </div>
          ) : null}

          <details className="admin-settings" open={settingsOpen} onToggle={(event) => setSettingsOpen(event.currentTarget.open)}>
            <summary>Post settings</summary>
            <label>
              <span className="admin-field-label">
                Web address<small>{post.slug ? `${siteOrigin}/blog/${post.slug}/` : "set automatically from the title"}</small>
              </span>
              <input
                value={post.slug}
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                disabled={!isNew}
                onChange={(event) => setPost((current) => ({ ...current, slug: event.target.value }))}
              />
              {!isNew ? <small className="admin-field-note">Fixed after the first save so published links keep working.</small> : null}
            </label>
          </details>

          <div className="admin-actions">
            <p className="admin-actions-note">
              {post.draft || isNew
                ? "Publishing commits the post and rebuilds the public site."
                : "This post is live. Saving it as a draft removes it from the site."}
            </p>
            <div className="admin-actions-buttons">
              <button className="quiet-button" type="button" disabled={saving} onClick={() => save(true)}>
                {post.draft || isNew ? "Save draft" : "Unpublish"}
              </button>
              <button className="primary-button" type="button" disabled={saving} onClick={() => save(false)}>
                {saving ? "Saving…" : post.draft || isNew ? "Publish" : "Save changes"}
              </button>
            </div>
          </div>

          {status ? (
            <p className={`admin-status${failed ? " is-error" : " is-good"}`} role="status">{status}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
