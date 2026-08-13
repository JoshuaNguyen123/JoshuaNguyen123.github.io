import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  addDays,
  createMetricSeries,
  dateInTimeZone,
  enumerateDates,
  markMetricStale,
  METRICS,
  TIME_ZONE,
  upgradeProvider,
  validateRawProvider,
} from "./activity-core.mjs";
import { validateSpoolEvent } from "./local-hook-core.mjs";

export const LOCAL_SOURCES = {
  cursorSessions: "Local Cursor hooks and retained conversation timestamps",
  cursorLines: "Local Cursor Agent and Tab edit hooks",
  claudeSessions: "Local Claude Code hooks and retained session timestamps",
};

function emptyLedger() {
  return {
    v: 1,
    providers: {
      cursor: { sessions: {}, lineChanges: {} },
      "claude-code": { sessions: {} },
    },
  };
}

function exactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value)
    && Object.keys(value).sort().join(",") === [...expected].sort().join(",");
}

export function validateLedger(ledger) {
  if (!exactKeys(ledger, ["v", "providers"]) || ledger.v !== 1 || !exactKeys(ledger.providers, ["cursor", "claude-code"])) throw new Error("Local activity ledger is invalid");
  if (!exactKeys(ledger.providers.cursor, ["sessions", "lineChanges"]) || !exactKeys(ledger.providers["claude-code"], ["sessions"])) throw new Error("Local activity ledger provider shape is invalid");
  for (const provider of ["cursor", "claude-code"]) {
    const sessions = ledger.providers[provider].sessions;
    if (!sessions || typeof sessions !== "object" || Array.isArray(sessions)) throw new Error("Local activity sessions are invalid");
    for (const [date, hashes] of Object.entries(sessions)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Array.isArray(hashes) || new Set(hashes).size !== hashes.length || hashes.some((hash) => typeof hash !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(hash))) throw new Error("Local activity session aggregate is invalid");
    }
  }
  for (const [date, value] of Object.entries(ledger.providers.cursor.lineChanges)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(value) || value < 0) throw new Error("Local activity line aggregate is invalid");
  }
  return ledger;
}

export function applySpoolEvents(ledgerInput, events) {
  const ledger = structuredClone(validateLedger(ledgerInput));
  for (const raw of events) {
    const event = validateSpoolEvent(raw);
    const provider = ledger.providers[event.provider];
    if (event.sessionKey) {
      const existing = new Set(provider.sessions[event.date] ?? []);
      existing.add(event.sessionKey);
      provider.sessions[event.date] = [...existing].sort();
    }
    if (event.provider === "cursor" && event.lineChanges > 0) {
      provider.lineChanges[event.date] = (provider.lineChanges[event.date] ?? 0) + event.lineChanges;
    }
  }
  return validateLedger(ledger);
}

async function atomicWrite(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, "utf8");
  await rename(temporary, file);
}

export async function consumeHookSpool(activityHome) {
  const config = JSON.parse(await readFile(path.join(activityHome, "config.json"), "utf8"));
  if (!exactKeys(config, ["hookSecret", "installedAt"]) || typeof config.hookSecret !== "string" || config.hookSecret.length < 32 || Number.isNaN(Date.parse(config.installedAt))) throw new Error("Local hook configuration is invalid");
  const ledgerFile = path.join(activityHome, "ledger.json");
  const ledger = existsSync(ledgerFile) ? validateLedger(JSON.parse(await readFile(ledgerFile, "utf8"))) : emptyLedger();
  const spool = path.join(activityHome, "spool");
  const files = existsSync(spool) ? (await readdir(spool)).filter((name) => name.endsWith(".json")).sort() : [];
  const events = [];
  for (const name of files) events.push(validateSpoolEvent(JSON.parse(await readFile(path.join(spool, name), "utf8"))));
  const updated = applySpoolEvents(ledger, events);
  if (files.length || !existsSync(ledgerFile)) await atomicWrite(ledgerFile, updated);
  for (const name of files) await rm(path.join(spool, name), { force: true });
  return { ledger: updated, installedAt: config.installedAt, consumed: files.length };
}

function objectDays(values) {
  return Object.entries(values).sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({ date, value }));
}

function sessionDays(values) {
  return Object.entries(values).sort(([left], [right]) => left.localeCompare(right)).map(([date, hashes]) => ({ date, value: hashes.length }));
}

function combineBeforeInstall(backfillDays, hookDays, installedDate) {
  return [
    ...backfillDays.filter((day) => day.date < installedDate),
    ...hookDays.filter((day) => day.date >= installedDate),
  ].sort((left, right) => left.date.localeCompare(right.date));
}

function installedCoverageDays(days, installedDate, today) {
  const byDate = new Map(days.map((day) => [day.date, day.value]));
  return enumerateDates(installedDate, today).map((date) => ({ date, value: byDate.get(date) ?? 0 }));
}

export function mergeHookLedger(backfillProviders, hookState, now = new Date().toISOString()) {
  const today = dateInTimeZone(now, TIME_ZONE);
  const installedDate = dateInTimeZone(hookState.installedAt, TIME_ZONE);
  const codex = upgradeProvider("codex", backfillProviders.codex);
  const cursorBackfill = upgradeProvider("cursor", backfillProviders.cursor);
  const claudeBackfill = upgradeProvider("claude-code", backfillProviders["claude-code"]);
  const cursorHookSessions = installedCoverageDays(sessionDays(hookState.ledger.providers.cursor.sessions), installedDate, today);
  const cursorSessions = combineBeforeInstall(cursorBackfill.metrics.activeSessions.days, cursorHookSessions, installedDate);
  const cursorLines = installedCoverageDays(objectDays(hookState.ledger.providers.cursor.lineChanges), installedDate, today);
  const claudeHookSessions = installedCoverageDays(sessionDays(hookState.ledger.providers["claude-code"].sessions), installedDate, today);
  const claudeSessions = combineBeforeInstall(claudeBackfill.metrics.activeSessions.days, claudeHookSessions, installedDate);
  const providers = {
    codex,
    cursor: {
      metrics: {
        activeSessions: createMetricSeries("cursor", "activeSessions", LOCAL_SOURCES.cursorSessions, cursorSessions, {
          coverage: cursorSessions.length ? { start: cursorSessions[0].date, end: today } : { start: installedDate, end: today },
          lastSyncedAt: now,
          lastAttemptedAt: now,
        }),
        appliedLineChanges: createMetricSeries("cursor", "appliedLineChanges", LOCAL_SOURCES.cursorLines, cursorLines, {
          coverage: { start: installedDate, end: today },
          lastSyncedAt: now,
          lastAttemptedAt: now,
        }),
      },
    },
    "claude-code": {
      metrics: {
        activeSessions: createMetricSeries("claude-code", "activeSessions", LOCAL_SOURCES.claudeSessions, claudeSessions, {
          coverage: claudeSessions.length ? { start: claudeSessions[0].date, end: today } : { start: installedDate, end: today },
          lastSyncedAt: now,
          lastAttemptedAt: now,
        }),
      },
    },
  };
  for (const provider of ["codex", "cursor", "claude-code"]) validateRawProvider(provider, providers[provider]);
  return providers;
}

export function chunkDateRange(start, end, maxDays = 90) {
  if (!Number.isInteger(maxDays) || maxDays < 1 || start > end) throw new Error("Invalid activity date range");
  const windows = [];
  let cursor = start;
  while (cursor <= end) {
    const windowEnd = [addDays(cursor, maxDays - 1), end].sort()[0];
    windows.push({ start: cursor, end: windowEnd, endExclusive: addDays(windowEnd, 1) });
    cursor = addDays(windowEnd, 1);
  }
  return windows;
}

export function aggregateCursorRows(rows, email) {
  const target = email.trim().toLowerCase();
  const totals = new Map();
  for (const row of rows) {
    if (!row || typeof row !== "object" || String(row.email ?? "").trim().toLowerCase() !== target) continue;
    const date = typeof row.date === "string" ? row.date.slice(0, 10) : new Date(Number(row.date)).toISOString().slice(0, 10);
    const value = Math.max(0, Math.round(Number(row.acceptedLinesAdded) || 0)) + Math.max(0, Math.round(Number(row.acceptedLinesDeleted) || 0));
    totals.set(date, (totals.get(date) ?? 0) + value);
  }
  return objectDays(Object.fromEntries(totals));
}

export function aggregateClaudeRows(rows, email, mode) {
  const target = email.trim().toLowerCase();
  return rows.reduce((total, row) => {
    const actorEmail = mode === "enterprise" ? row?.user?.email_address : row?.actor?.email_address;
    if (String(actorEmail ?? "").trim().toLowerCase() !== target) return total;
    const value = mode === "enterprise" ? row?.claude_code_metrics?.core_metrics?.distinct_session_count : row?.core_metrics?.num_sessions;
    return total + Math.max(0, Math.round(Number(value) || 0));
  }, 0);
}

export function mergeMetric(provider, metricId, previous, fresh) {
  if (!previous || previous.status === "unavailable") return fresh;
  if (!fresh || fresh.status === "unavailable") return markMetricStale(provider, metricId, previous, fresh?.lastAttemptedAt ?? new Date().toISOString());
  const byDate = new Map(previous.days.map((day) => [day.date, day.value]));
  for (const day of fresh.days) byDate.set(day.date, day.value);
  const days = [...byDate.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([date, value]) => ({ date, value }));
  return createMetricSeries(provider, metricId, fresh.source, days, {
    status: fresh.status,
    coverage: { start: [previous.coverage.start, fresh.coverage.start].filter(Boolean).sort()[0] ?? null, end: [previous.coverage.end, fresh.coverage.end].filter(Boolean).sort().at(-1) ?? null },
    lastSyncedAt: fresh.lastSyncedAt,
    lastAttemptedAt: fresh.lastAttemptedAt,
  });
}

export function mergeProvider(provider, previous, fresh) {
  const prior = upgradeProvider(provider, previous);
  const next = upgradeProvider(provider, fresh);
  return {
    metrics: Object.fromEntries(Object.keys(METRICS[provider]).map((metricId) => [metricId, mergeMetric(provider, metricId, prior.metrics[metricId], next.metrics[metricId])])),
  };
}

export function snapshotsMatch(left, right) {
  const comparable = (value) => {
    const clone = structuredClone(value);
    delete clone.generatedAt;
    for (const provider of Object.values(clone.providers ?? {})) for (const metric of Object.values(provider.metrics ?? {})) {
      delete metric.lastSyncedAt;
      delete metric.lastAttemptedAt;
    }
    return JSON.stringify(clone);
  };
  return comparable(left) === comparable(right);
}

export function hookFailureProviders(previous, attemptedAt = new Date().toISOString()) {
  return Object.fromEntries(["cursor", "claude-code"].map((provider) => {
    const prior = upgradeProvider(provider, previous?.[provider]);
    return [provider, {
      metrics: Object.fromEntries(Object.entries(prior.metrics).map(([metricId, metric]) => [metricId, markMetricStale(provider, metricId, metric, attemptedAt)])),
    }];
  }));
}
