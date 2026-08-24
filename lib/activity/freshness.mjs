function primaryMetrics(snapshot) {
  return [
    snapshot.providers.github.metrics.contributions,
    snapshot.providers.codex.metrics.activeSessions,
    snapshot.providers.cursor.metrics.activeSessions,
    snapshot.providers.cursor.metrics.usagePresence,
    snapshot.providers["claude-code"].metrics.activeSessions,
  ];
}

function compareMetricEvidence(candidate, current) {
  const candidateEnd = candidate.coverage.end ?? "";
  const currentEnd = current.coverage.end ?? "";
  if (candidateEnd !== currentEnd) return candidateEnd > currentEnd ? 1 : -1;

  const candidateStatus = candidate.status === "available" ? 2 : candidate.status === "stale" ? 1 : 0;
  const currentStatus = current.status === "available" ? 2 : current.status === "stale" ? 1 : 0;
  if (candidateStatus !== currentStatus) return candidateStatus > currentStatus ? 1 : -1;

  const candidateSynced = candidate.lastSyncedAt ? Date.parse(candidate.lastSyncedAt) : 0;
  const currentSynced = current.lastSyncedAt ? Date.parse(current.lastSyncedAt) : 0;
  return Math.sign(candidateSynced - currentSynced);
}

export function shouldUseActivitySnapshot(current, candidate) {
  const currentMetrics = primaryMetrics(current);
  const candidateMetrics = primaryMetrics(candidate);
  let candidateWins = 0;
  let currentWins = 0;

  for (let index = 0; index < currentMetrics.length; index += 1) {
    const comparison = compareMetricEvidence(candidateMetrics[index], currentMetrics[index]);
    if (comparison > 0) candidateWins += 1;
    if (comparison < 0) currentWins += 1;
  }

  if (candidateWins !== currentWins) return candidateWins > currentWins;
  return Date.parse(candidate.generatedAt) > Date.parse(current.generatedAt);
}
