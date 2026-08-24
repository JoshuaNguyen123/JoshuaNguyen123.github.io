const BLOG_KEYS = ["slug", "title", "summary", "publishedAt", "tags", "draft"];
const BLOG_KEY_SET = new Set(BLOG_KEYS);
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function fail(message) {
  throw new Error(`Blog source: ${message}`);
}

function parseScalar(value) {
  const trimmed = value.trim();
  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed.startsWith('"') || trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try { return JSON.parse(trimmed); } catch { fail("frontmatter contains invalid JSON-style YAML"); }
  }
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) return trimmed.slice(1, -1).replaceAll("''", "'");
  return trimmed;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

export function validateBlogMetadata(metadata) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) fail("frontmatter must be an object");
  const keys = Object.keys(metadata);
  const unknown = keys.filter((key) => !BLOG_KEY_SET.has(key));
  const missing = BLOG_KEYS.filter((key) => !keys.includes(key));
  if (unknown.length) fail(`unknown frontmatter keys: ${unknown.join(", ")}`);
  if (missing.length) fail(`missing frontmatter keys: ${missing.join(", ")}`);
  if (typeof metadata.slug !== "string" || !SLUG_PATTERN.test(metadata.slug)) fail("slug must contain lowercase letters, numbers, and single hyphens only");
  if (typeof metadata.title !== "string" || !metadata.title.trim() || metadata.title.length > 160) fail("title must be 1-160 characters");
  if (typeof metadata.summary !== "string" || !metadata.summary.trim() || metadata.summary.length > 320) fail("summary must be 1-320 characters");
  if (typeof metadata.publishedAt !== "string" || !validDate(metadata.publishedAt)) fail("publishedAt must be a real YYYY-MM-DD date");
  if (!Array.isArray(metadata.tags) || metadata.tags.length < 1 || metadata.tags.length > 8 || metadata.tags.some((tag) => typeof tag !== "string" || !tag.trim() || tag.length > 40)) fail("tags must contain 1-8 non-empty values of at most 40 characters");
  if (typeof metadata.draft !== "boolean") fail("draft must be true or false");
  return {
    slug: metadata.slug,
    title: metadata.title.trim(),
    summary: metadata.summary.trim(),
    publishedAt: metadata.publishedAt,
    tags: metadata.tags.map((tag) => tag.trim()),
    draft: metadata.draft,
  };
}

export function parseBlogSource(source) {
  if (typeof source !== "string" || source.length > 100_000) fail("post must be text no larger than 100 KB");
  const normalized = source.replaceAll("\r\n", "\n");
  if (!normalized.startsWith("---\n")) fail("post must start with frontmatter");
  const closing = normalized.indexOf("\n---\n", 4);
  if (closing < 0) fail("frontmatter closing delimiter is missing");
  const lines = normalized.slice(4, closing).split("\n");
  const data = {};
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /^([A-Za-z][A-Za-z0-9]*):(?:\s*(.*))?$/.exec(line);
    if (!match) fail(`invalid frontmatter line ${index + 1}`);
    const [, key, rawValue = ""] = match;
    if (Object.hasOwn(data, key)) fail(`duplicate frontmatter key: ${key}`);
    if (key === "tags" && rawValue.trim() === "") {
      const tags = [];
      while (index + 1 < lines.length && /^\s+-\s+/.test(lines[index + 1])) {
        index += 1;
        tags.push(parseScalar(lines[index].replace(/^\s+-\s+/, "")));
      }
      data[key] = tags;
    } else {
      data[key] = parseScalar(rawValue);
    }
  }
  return { metadata: validateBlogMetadata(data), body: normalized.slice(closing + 5) };
}

export function buildBlogSource(metadata, body = "") {
  const value = validateBlogMetadata(metadata);
  const frontmatter = [
    "---",
    `slug: ${JSON.stringify(value.slug)}`,
    `title: ${JSON.stringify(value.title)}`,
    `summary: ${JSON.stringify(value.summary)}`,
    `publishedAt: ${JSON.stringify(value.publishedAt)}`,
    `tags: ${JSON.stringify(value.tags)}`,
    `draft: ${value.draft}`,
    "---",
  ];
  return `${frontmatter.join("\n")}\n\n${String(body).replaceAll("\r\n", "\n").trim()}\n`;
}

export function isBlogSlug(value) {
  return typeof value === "string" && SLUG_PATTERN.test(value);
}
