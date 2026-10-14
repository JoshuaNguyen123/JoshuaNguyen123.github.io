"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { parseActivitySnapshot } from "@/lib/activity/live-snapshot";
import { shouldUseActivitySnapshot } from "@/lib/activity/freshness.mjs";
import type { ActivitySnapshot } from "@/lib/activity/types";

const liveFeedUrl = process.env.NEXT_PUBLIC_ACTIVITY_FEED_URL
  ?? "https://raw.githubusercontent.com/JoshuaNguyen123/JoshuaNguyen123.github.io/main/public/data/activity.json";
const pollDelayMs = 300_000;
const maxRetryDelayMs = 1_800_000;

type ActivityFeedValue = {
  data: ActivitySnapshot;
  feedState: "checking" | "live" | "fallback" | "bundled";
};

const ActivityFeedContext = createContext<ActivityFeedValue | null>(null);

export function ActivityFeedProvider({ initialData, children }: {
  initialData: ActivitySnapshot;
  children: ReactNode;
}) {
  // Commit the snapshot and its freshness status together so every consumer
  // sees the same validated record, including when the feed is unavailable.
  const [feed, setFeed] = useState<ActivityFeedValue>({ data: initialData, feedState: "checking" });

  useEffect(() => {
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;
    const poll = async () => {
      try {
        const response = await fetch(`${liveFeedUrl}?v=${Date.now()}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Live activity feed was unavailable");
        const snapshot = parseActivitySnapshot(await response.json());
        if (!snapshot || snapshot.mode !== "observed") throw new Error("Live activity feed failed validation");
        if (cancelled) return;
        failures = 0;
        setFeed((current) => {
          const useLive = shouldUseActivitySnapshot(current.data, snapshot);
          return { data: useLive ? snapshot : current.data, feedState: useLive ? "live" : "bundled" };
        });
      } catch {
        if (cancelled) return;
        failures += 1;
        setFeed((current) => ({ ...current, feedState: "fallback" }));
      }
      if (!cancelled) timeout = setTimeout(poll, failures ? Math.min(pollDelayMs * 2 ** failures, maxRetryDelayMs) : pollDelayMs);
    };
    void poll();
    return () => { cancelled = true; if (timeout) clearTimeout(timeout); };
  }, []);

  return <ActivityFeedContext.Provider value={feed}>{children}</ActivityFeedContext.Provider>;
}

export function useActivityFeed() {
  const feed = useContext(ActivityFeedContext);
  if (!feed) throw new Error("Activity components must share an ActivityFeedProvider");
  return feed;
}
