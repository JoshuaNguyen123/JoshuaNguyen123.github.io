import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { CURSOR_USAGE_HEADERS } from "../scripts/import-cursor-usage.mjs";
import {
  CURSOR_EXPORT_URL,
  buildCursorSessionCookie,
  cursorStateDbPath,
  downloadCursorUsageCsv,
  jwtPayload,
  mergeCursorUsageCsv,
  readCursorAccessToken,
  run,
} from "../scripts/download-cursor-usage.mjs";
import { validateHistoryBackfill } from "../scripts/history-backfill-core.mjs";

function fakeJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${header}.${body}.sig`;
}

function csvRow({ date = "2026-01-01T12:00:00Z", total = 10 } = {}) {
  return [date, "cloud", "auto", "Included", "model", "No", "1", "2", "3", "4", String(total), "Included"]
    .map((value) => `"${value}"`)
    .join(",");
}

function sampleCsv(rows = [csvRow()]) {
  return `${CURSOR_USAGE_HEADERS.join(",")}\n${rows.join("\n")}\n`;
}

async function writeTokenDb(root, token) {
  const dbPath = path.join(root, "state.vscdb");
  const database = new DatabaseSync(dbPath);
  database.exec("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)");
  database.prepare("INSERT INTO ItemTable (key, value) VALUES (?, ?)").run("cursorAuth/accessToken", token);
  database.close();
  return dbPath;
}

test("cursorStateDbPath honors CURSOR_STATE_DB_PATH", () => {
  const override = path.join(tmpdir(), "custom-state.vscdb");
  assert.equal(cursorStateDbPath({ CURSOR_STATE_DB_PATH: override }), path.resolve(override));
});

test("JWT payload and session cookie use the subject user id", () => {
  const token = fakeJwt({ sub: "auth0|user-abc-123" });
  assert.equal(jwtPayload(token).sub, "auth0|user-abc-123");
  const cookie = buildCursorSessionCookie(token);
  assert.equal(cookie, encodeURIComponent(`user-abc-123::${token}`));
  assert.doesNotMatch(cookie, /auth0\|/);
});

test("readCursorAccessToken loads plain and JSON-encoded tokens", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "cursor-token-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const token = fakeJwt({ sub: "auth0|abc" });
  assert.equal(readCursorAccessToken(await writeTokenDb(root, token)), token);

  const jsonRoot = await mkdtemp(path.join(tmpdir(), "cursor-token-json-"));
  t.after(async () => {
    await rm(jsonRoot, { recursive: true, force: true });
  });
  assert.equal(readCursorAccessToken(await writeTokenDb(jsonRoot, JSON.stringify(token))), token);
});

test("downloadCursorUsageCsv sends the session cookie and rejects HTML", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "cursor-dl-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const token = fakeJwt({ sub: "auth0|user-1" });
  const dbPath = await writeTokenDb(root, token);
  const calls = [];
  const csv = sampleCsv();
  const body = await downloadCursorUsageCsv({
    dbPath,
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true, text: async () => csv };
    },
  });
  assert.equal(body, csv);
  assert.equal(calls[0].url, CURSOR_EXPORT_URL);
  assert.match(calls[0].init.headers.Cookie, /^WorkosCursorSessionToken=/);
  // Cookie is percent-encoded; the raw JWT must not appear as a separate header field.
  assert.equal(calls[0].init.headers.Authorization, undefined);

  await assert.rejects(
    () => downloadCursorUsageCsv({
      dbPath,
      fetchImpl: async () => ({ ok: true, text: async () => "<html>login</html>" }),
    }),
    /HTML instead of CSV/,
  );
});

test("run downloads CSV and merges binary presence days only", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "cursor-run-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const out = path.join(root, "history-backfill.json");
  const token = fakeJwt({ sub: "auth0|user-2" });
  const dbPath = await writeTokenDb(root, token);
  const result = await run(["--out", out], {
    env: { CURSOR_STATE_DB_PATH: dbPath },
    now: new Date("2026-02-01T00:00:00Z"),
    fetchImpl: async () => ({
      ok: true,
      text: async () => sampleCsv([csvRow({ date: "2026-01-15T18:00:00Z" })]),
    }),
  });
  assert.equal(result.skipped, false);
  assert.equal(result.source, "dashboard-csv");
  assert.equal(result.addedDays, 1);
  const backfill = validateHistoryBackfill(JSON.parse(await readFile(out, "utf8")));
  assert.deepEqual(backfill.providers.cursor.usagePresence, [{ date: "2026-01-15", value: 1 }]);
  const written = await readFile(out, "utf8");
  for (const forbidden of ["WorkosCursorSessionToken", "accessToken", "user-2", "Total Tokens", "model"]) {
    assert.doesNotMatch(written, new RegExp(forbidden, "i"));
  }
});

test("mergeCursorUsageCsv reuses the import reducer contract", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "cursor-merge-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  const out = path.join(root, "history-backfill.json");
  const merged = await mergeCursorUsageCsv(sampleCsv(), { out, now: new Date("2026-02-01T00:00:00Z") });
  assert.equal(merged.rowsValidated, 1);
  assert.equal(merged.observedDays, 1);
});

test("missing state DB and missing token fail clearly", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "cursor-missing-"));
  t.after(async () => {
    await rm(root, { recursive: true, force: true });
  });
  assert.throws(() => readCursorAccessToken(path.join(root, "missing.vscdb")), /not found/);
  const emptyDb = path.join(root, "empty.vscdb");
  const database = new DatabaseSync(emptyDb);
  database.exec("CREATE TABLE ItemTable (key TEXT PRIMARY KEY, value TEXT)");
  database.close();
  assert.throws(() => readCursorAccessToken(emptyDb), /access token not found/i);
});
