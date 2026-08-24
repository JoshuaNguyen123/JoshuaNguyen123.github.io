import assert from "node:assert/strict";
import test from "node:test";
import { shouldUseActivitySnapshot } from "../lib/activity/freshness.mjs";

function metric({ end = "2026-08-23", synced = "2026-08-24T05:00:00Z", status = "available" } = {}) {
  return { status, coverage: { start: "2026-01-01", end }, lastSyncedAt: synced };
}

function snapshot({ generatedAt, github, codex, cursor, usage, claude }) {
  return {
    generatedAt,
    providers: {
      github: { metrics: { contributions: github } },
      codex: { metrics: { activeSessions: codex } },
      cursor: { metrics: { activeSessions: cursor, usagePresence: usage } },
      "claude-code": { metrics: { activeSessions: claude } },
    },
  };
}

test("provider evidence outranks a newer wrapper timestamp", () => {
  const bundled = snapshot({
    generatedAt: "2026-08-24T07:46:00Z",
    github: metric({ end: "2026-08-24", synced: "2026-08-24T07:46:00Z" }),
    codex: metric(), cursor: metric(), usage: metric({ end: "2026-08-22" }), claude: metric(),
  });
  const live = snapshot({
    generatedAt: "2026-08-24T07:45:00Z",
    github: metric({ end: "2026-08-24", synced: "2026-08-24T07:45:00Z" }),
    codex: metric({ end: "2026-08-24", synced: "2026-08-24T07:45:00Z" }),
    cursor: metric({ end: "2026-08-24", synced: "2026-08-24T07:45:00Z" }),
    usage: metric({ end: "2026-08-22", synced: "2026-08-24T07:45:00Z" }),
    claude: metric({ end: "2026-08-24", synced: "2026-08-24T07:45:00Z" }),
  });
  assert.equal(shouldUseActivitySnapshot(bundled, live), true);
});

test("generatedAt breaks a tie when provider evidence is identical", () => {
  const evidence = metric();
  const older = snapshot({ generatedAt: "2026-08-24T05:00:00Z", github: evidence, codex: evidence, cursor: evidence, usage: evidence, claude: evidence });
  const newer = snapshot({ generatedAt: "2026-08-24T06:00:00Z", github: evidence, codex: evidence, cursor: evidence, usage: evidence, claude: evidence });
  assert.equal(shouldUseActivitySnapshot(older, newer), true);
  assert.equal(shouldUseActivitySnapshot(newer, older), false);
});
