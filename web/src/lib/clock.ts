"use client";

import { useEffect, useState } from "react";
import { getServerTime } from "./api";

export function useServerClock() {
  const [offset, setOffset] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    async function sync() {
      try {
        const started = Date.now();
        const { now: server } = await getServerTime();
        const ended = Date.now();
        if (alive) setOffset(new Date(server).getTime() - (started + ended) / 2);
      } catch {
        if (alive) setOffset((value) => value);
      }
    }
    sync();
    const syncTimer = setInterval(sync, 30000);
    const tickTimer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false;
      clearInterval(syncTimer);
      clearInterval(tickTimer);
    };
  }, []);

  return { now: now + (offset ?? 0), synced: offset !== null };
}
