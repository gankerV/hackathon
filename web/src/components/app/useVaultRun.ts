"use client";

import { useCallback, useRef, useState } from "react";
import type { NodeView } from "@/components/ui";
import type { VaultEvent } from "@/lib/tide";

const PACE = 320;

function freshNodes(): NodeView[] {
  return [1, 2, 3, 4, 5].map((id) => ({ id, state: "idle" }));
}

export function useVaultRun() {
  const [nodes, setNodes] = useState<NodeView[]>(freshNodes);
  const [active, setActive] = useState(false);
  const queue = useRef<VaultEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiters = useRef<(() => void)[]>([]);

  const drain = useCallback(() => {
    const next = queue.current.shift();
    if (!next) {
      timer.current = null;
      const pending = waiters.current;
      waiters.current = [];
      pending.forEach((resolve) => resolve());
      return;
    }
    if (next.kind === "node") {
      setNodes((current) => current.map((node) => (node.id === next.node ? { ...node, state: next.state, detail: next.detail } : node)));
    }
    const slow = next.kind === "node" && next.state !== "pending";
    timer.current = setTimeout(drain, slow ? PACE : 0);
  }, []);

  const listener = useCallback(
    (event: VaultEvent) => {
      if (event.kind !== "node") return;
      queue.current.push(event);
      if (!timer.current) timer.current = setTimeout(drain, 0);
    },
    [drain],
  );

  const settle = useCallback(() => {
    if (!timer.current && queue.current.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => waiters.current.push(resolve));
  }, []);

  const start = useCallback(() => {
    queue.current = [];
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setNodes(freshNodes());
    setActive(true);
  }, []);

  const reset = useCallback(() => {
    queue.current = [];
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setNodes(freshNodes());
    setActive(false);
  }, []);

  const okCount = nodes.filter((node) => node.state === "ok").length;
  const refusedCount = nodes.filter((node) => node.state === "refused").length;

  return { nodes, active, okCount, refusedCount, listener, settle, start, reset };
}
