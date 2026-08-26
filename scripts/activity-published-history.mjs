// Carries already-published local-tool history forward into a new snapshot.
//
// Two machines produce this feed. The local publisher exports fresh Codex,
// Cursor, and Claude Code aggregates and pushes the finished
// public/data/activity.json. CI cannot see any of that: it only has whatever
// data/local-activity.json was last committed, which is usually a day or two
// behind. Rebuilding from the committed export alone therefore publishes a
// bundle that regresses the feed the site is already serving — the dashboard
// paints the smaller CI numbers first, then swaps to the live feed a moment
// later, and the two disagree in between.
//
// So every build merges the published snapshot forward before assembling:
// per-date maximum, union coverage, freshest metadata. The merge is monotone
// and idempotent, which matches how history-backfill.json is applied, and it
// guarantees a rebuild can only ever match or exceed what is already public.
//
// GitHub is deliberately left out. Every build fetches the contribution
// calendar directly, and that answer is authoritative in a way that a previous
// snapshot is not.
import {
  createMetricSeries,
  PRIVACY_VERSION,
  SCHEMA_VERSION,
  TIME_ZONE,
  validateRawProvider,
} from "./activity-core.mjs";
import { mergeBackfillDays } from "./history-backfill-core.mjs";

export const LOCAL_HISTORY_PROVIDERS = ["codex", "cursor", "claude-code"];

function statusRank(status) {
  return status === "available" ? 2 : status === "stale" ? 1 : 0;
}

function latestTimestamp(left, right) {
  const leftValue = left ? Date.parse(left) : Number.NaN;
  const rightValue = right ? Date.parse(right) : Number.NaN;
  if (Number.isNaN(leftValue)) return Number.isNaN(rightValue) ? null : right;
  if (Number.isNaN(rightValue)) return left;
  return leftValue >= rightValue ? left : right;
}

function mergeMetric(provider, metricId, published, local) {
  if (published.status === "unavailable" || !published.days.length) return local;
  // An unavailable local metric contributes nothing but must not drag the
  // published coverage or status back down with it.
  const current = local.status === "unavailable" ? null : local;
  const days = mergeBackfillDays(
    published.days.map(({ date, value }) => ({ date, value })),
    current ? current.days : [],
  );
  const starts = [published.coverage.start, current?.coverage.start].filter(Boolean).sort();
  const ends = [published.coverage.end, current?.coverage.end].filter(Boolean).sort();
  return createMetricSeries(provider, metricId, current ? current.source : published.source, days, {
    coverage: { start: starts[0] ?? null, end: ends.at(-1) ?? null },
    status: statusRank(published.status) >= statusRank(local.status) ? published.status : local.status,
    lastSyncedAt: latestTimestamp(published.lastSyncedAt, current?.lastSyncedAt ?? null),
    lastAttemptedAt: latestTimestamp(published.lastAttemptedAt, current?.lastAttemptedAt ?? null),
  });
}

// Fixture snapshots must never seed a real build, and an older schema is not
// worth upgrading here — skipping simply falls back to today's behaviour.
export function isMergeableSnapshot(snapshot) {
  return Boolean(snapshot)
    && snapshot.mode === "observed"
    && snapshot.schemaVersion === SCHEMA_VERSION
    && snapshot.privacyVersion === PRIVACY_VERSION
    && snapshot.timeZone === TIME_ZONE;
}

export function totalRecordedDays(provider) {
  return Object.values(provider.metrics).reduce(
    (sum, metric) => sum + metric.days.reduce((metricSum, day) => metricSum + day.value, 0),
    0,
  );
}

/**
 * Merges the published snapshot's local-tool history into `providers` in place.
 * Any provider that fails validation is skipped and reported through `onSkip`,
 * so a damaged snapshot degrades to a plain rebuild instead of failing a build.
 */
export function mergePublishedHistory(providers, snapshot, { onSkip, onCarry } = {}) {
  if (!isMergeableSnapshot(snapshot)) {
    onSkip?.("the published snapshot is a different mode or schema");
    return providers;
  }
  for (const provider of LOCAL_HISTORY_PROVIDERS) {
    const before = totalRecordedDays(providers[provider]);
    try {
      const published = validateRawProvider(provider, snapshot.providers?.[provider], { publicDays: true });
      const metrics = Object.fromEntries(Object.entries(providers[provider].metrics).map(([metricId, metric]) => [
        metricId,
        published.metrics[metricId] ? mergeMetric(provider, metricId, published.metrics[metricId], metric) : metric,
      ]));
      // Only adopt the merge once the whole provider still validates.
      providers[provider] = validateRawProvider(provider, { metrics });
    } catch (error) {
      onSkip?.(`${provider}: ${error.message}`);
      continue;
    }
    const after = totalRecordedDays(providers[provider]);
    if (after > before) onCarry?.(provider, after - before);
  }
  return providers;
}
