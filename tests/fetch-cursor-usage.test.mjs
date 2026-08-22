import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { reduceUsageEvents, run } from "../scripts/fetch-cursor-usage.mjs";

const now = new Date("2026-08-22T12:00:00Z");

test("fetch is a no-op without an API key", async () => {
  const result = await run([], { env: {}, now, fetchImpl: () => { throw new Error("must not fetch"); } });
  assert.deepEqual(result, { skipped: true, reason: "CURSOR_ADMIN_API_KEY is not set" });
});

test("usage events reduce to unique presence days and drop bad or future timestamps", () => {
  const days = reduceUsageEvents([
    { timestamp: Date.parse("2026-08-20T02:00:00Z") },
    { timestamp: String(Date.parse("2026-08-20T05:00:00Z")) },
    { timestamp: Date.parse("2026-08-21T23:00:00Z") },
    { timestamp: "nonsense" },
    { timestamp: now.getTime() + 60 * 60 * 1000 },
  ], { now });
  // America/Denver: 02:00Z and 05:00Z on the 20th are still the evening of the 19th.
  assert.deepEqual(days.map((day) => day.date), ["2026-08-19", "2026-08-21"]);
  assert.ok(days.every((day) => day.value === 1));
});

test("fetch pages through the Admin API, sends Basic auth, and writes only presence days", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const body = JSON.parse(init.body);
    const page = body.page;
    return {
      ok: true,
      json: async () => ({
        usageEvents: page === 1
          ? [{ timestamp: Date.parse("2026-08-21T10:00:00Z"), userEmail: "secret@example.com", model: "x", tokenUsage: { inputTokens: 9 } }]
          : [],
        pagination: { hasNextPage: page === 1 },
      }),
    };
  };
  const dir = await mkdtemp(path.join(os.tmpdir(), "cursor-fetch-"));
  const out = path.join(dir, "history-backfill.json");
  const result = await run(["--days", "7", "--out", out], { env: { CURSOR_ADMIN_API_KEY: "key123" }, fetchImpl, now });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api.cursor.com/teams/filtered-usage-events");
  assert.equal(calls[0].init.headers.Authorization, `Basic ${Buffer.from("key123:").toString("base64")}`);
  const requested = JSON.parse(calls[0].init.body);
  assert.equal(requested.endDate - requested.startDate, 7 * 24 * 60 * 60 * 1000);
  assert.equal(result.addedDays, 1);
  const written = await readFile(out, "utf8");
  assert.doesNotMatch(written, /secret@example.com|tokenUsage/);
  assert.match(written, /"2026-08-21"/);
});
