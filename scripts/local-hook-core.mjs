import { createHmac, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { dateInTimeZone, isTimeZone, stampTimeZone } from "./activity-core.mjs";

const MAX_EXACT_DIFF_CHARACTERS = 250_000;
const MAX_EXACT_DIFF_LINES = 10_000;
const MAX_EXACT_DIFF_CELLS = 2_000_000;

function lines(value) {
  if (typeof value !== "string" || value.length === 0) return [];
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function lineCount(value) {
  if (typeof value !== "string" || value.length === 0) return 0;
  let count = 1;
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\n") count += 1;
    else if (value[index] === "\r" && value[index + 1] !== "\n") count += 1;
  }
  return count;
}

function replacementCounts(oldText, newText) {
  const deletions = lineCount(oldText);
  const additions = lineCount(newText);
  return { additions, deletions, total: additions + deletions };
}

export function lineChangeCounts(oldText, newText) {
  if (oldText === newText) return { additions: 0, deletions: 0, total: 0 };
  if (typeof oldText !== "string" || typeof newText !== "string") return replacementCounts(oldText, newText);
  if (oldText.length + newText.length > MAX_EXACT_DIFF_CHARACTERS) return replacementCounts(oldText, newText);
  const before = lines(oldText);
  const after = lines(newText);
  const n = before.length;
  const m = after.length;
  if (!n) return { additions: m, deletions: 0, total: m };
  if (!m) return { additions: 0, deletions: n, total: n };
  if (n + m > MAX_EXACT_DIFF_LINES || n * m > MAX_EXACT_DIFF_CELLS) return replacementCounts(oldText, newText);
  const frontier = new Map([[1, 0]]);
  for (let distance = 0; distance <= n + m; distance += 1) {
    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const down = frontier.get(diagonal + 1) ?? -1;
      const right = (frontier.get(diagonal - 1) ?? -1) + 1;
      let x = diagonal === -distance || (diagonal !== distance && down > right) ? down : right;
      let y = x - diagonal;
      while (x < n && y < m && x >= 0 && y >= 0 && before[x] === after[y]) {
        x += 1;
        y += 1;
      }
      frontier.set(diagonal, x);
      if (x >= n && y >= m) {
        const additions = (distance + m - n) / 2;
        const deletions = distance - additions;
        return { additions, deletions, total: additions + deletions };
      }
    }
  }
  return { additions: m, deletions: n, total: m + n };
}

function sumCursorEdits(payload, tab) {
  if (!Array.isArray(payload.edits)) return 0;
  return payload.edits.reduce((total, edit) => {
    if (!edit || typeof edit !== "object") return total;
    const before = tab ? edit.old_line ?? edit.old_string : edit.old_string;
    const after = tab ? edit.new_line ?? edit.new_string : edit.new_string;
    return total + lineChangeCounts(before, after).total;
  }, 0);
}

function keyedSession(secret, provider, date, identifier) {
  if (typeof identifier !== "string" || !identifier) return null;
  return createHmac("sha256", secret).update(`${provider}\0${date}\0${identifier}`).digest("base64url");
}

export function reduceHookPayload(kind, payload, secret, now = new Date(), timeZone = stampTimeZone()) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || typeof secret !== "string" || secret.length < 32) return null;
  const date = dateInTimeZone(now, timeZone);
  const at = now instanceof Date ? now.toISOString() : new Date(now).toISOString();
  if (kind === "cursor-session" || kind === "cursor-agent-edit" || kind === "cursor-tab-edit") {
    const sessionId = payload.conversation_id
      ?? payload.conversationId
      ?? payload.composer_id
      ?? payload.composerId
      ?? payload.generation_id
      ?? payload.generationId
      ?? payload.session_id
      ?? payload.sessionId;
    const sessionKey = keyedSession(secret, "cursor", date, sessionId);
    const lineChanges = kind === "cursor-agent-edit" ? sumCursorEdits(payload, false)
      : kind === "cursor-tab-edit" ? sumCursorEdits(payload, true) : 0;
    if (!sessionKey && lineChanges === 0) return null;
    return { v: 1, provider: "cursor", date, timeZone, at, event: kind, sessionKey, lineChanges };
  }
  if (kind === "claude-session" || kind === "claude-activity") {
    const sessionKey = keyedSession(secret, "claude-code", date, payload.session_id);
    if (!sessionKey) return null;
    return { v: 1, provider: "claude-code", date, timeZone, at, event: kind, sessionKey, lineChanges: 0 };
  }
  return null;
}

export function validateSpoolEvent(event) {
  if (!event || typeof event !== "object" || Array.isArray(event)) throw new Error("Invalid aggregate hook event");
  const required = ["date", "event", "lineChanges", "provider", "sessionKey", "v"];
  const optional = new Set(["timeZone", "at"]);
  const keys = Object.keys(event);
  if (required.some((key) => !Object.hasOwn(event, key)) || keys.some((key) => !required.includes(key) && !optional.has(key))) {
    throw new Error("Aggregate hook event contains unexpected fields");
  }
  if (event.v !== 1 || !["cursor", "claude-code"].includes(event.provider) || !/^\d{4}-\d{2}-\d{2}$/.test(event.date)) throw new Error("Invalid aggregate hook event metadata");
  if (event.timeZone != null && !isTimeZone(event.timeZone)) throw new Error("Invalid aggregate hook event time zone");
  if (event.at != null && (typeof event.at !== "string" || Number.isNaN(Date.parse(event.at)))) throw new Error("Invalid aggregate hook event timestamp");
  if (event.sessionKey !== null && (typeof event.sessionKey !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(event.sessionKey))) throw new Error("Invalid aggregate session key");
  if (!Number.isInteger(event.lineChanges) || event.lineChanges < 0) throw new Error("Invalid aggregate line count");
  if (typeof event.event !== "string" || !["cursor-session", "cursor-agent-edit", "cursor-tab-edit", "claude-session", "claude-activity"].includes(event.event)) throw new Error("Invalid aggregate event type");
  return event;
}

export async function writeSpoolEvent(activityHome, event) {
  validateSpoolEvent(event);
  const spool = path.join(activityHome, "spool");
  await mkdir(spool, { recursive: true });
  const filename = `${Date.now()}-${randomUUID()}.json`;
  const target = path.join(spool, filename);
  await writeFile(target, `${JSON.stringify(event)}\n`, { encoding: "utf8", flag: "wx" });
  return target;
}

export async function readHookSecret(activityHome) {
  const config = JSON.parse(await readFile(path.join(activityHome, "config.json"), "utf8"));
  const keys = Object.keys(config).sort().join(",");
  if (keys !== "hookSecret,installedAt" || typeof config.hookSecret !== "string" || config.hookSecret.length < 32 || Number.isNaN(Date.parse(config.installedAt))) throw new Error("Local activity hook configuration is invalid");
  return config.hookSecret;
}
