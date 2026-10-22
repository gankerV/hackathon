"use client";

import { useCallback, useRef, useState } from "react";
import type { NodeView, Step, StepState } from "@/components/ui";
import type { VaultEvent } from "@/lib/tide";

type StepPlan = { id: string; label: string };

const PACE = 320;

function freshNodes(): NodeView[] {
  return [1, 2, 3, 4, 5].map((id) => ({ id, state: "idle" }));
}

export function useVaultRun(plan: StepPlan[]) {
  const [nodes, setNodes] = useState<NodeView[]>(freshNodes);
  const [steps, setSteps] = useState<Step[]>(() => plan.map((step) => ({ ...step, state: "todo" as StepState })));
  const queue = useRef<VaultEvent[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const waiters = useRef<(() => void)[]>([]);

  const apply = useCallback((event: VaultEvent) => {
    if (event.kind === "node") {
      setNodes((current) => current.map((node) => (node.id === event.node ? { ...node, state: event.state, detail: event.detail } : node)));
    } else {
      setSteps((current) => current.map((step) => (step.id === event.step ? { ...step, state: event.state === "active" ? "active" : event.state === "done" ? "done" : "failed", detail: event.detail ?? step.detail } : step)));
    }
  }, []);

  const drain = useCallback(() => {
    const next = queue.current.shift();
    if (!next) {
      timer.current = null;
      const pending = waiters.current;
      waiters.current = [];
      pending.forEach((resolve) => resolve());
      return;
    }
    apply(next);
    const slow = next.kind === "node" && next.state !== "pending";
    timer.current = setTimeout(drain, slow ? PACE : 60);
  }, [apply]);

  const listener = useCallback(
    (event: VaultEvent) => {
      queue.current.push(event);
      if (!timer.current) timer.current = setTimeout(drain, 0);
    },
    [drain],
  );

  const mark = useCallback((id: string, state: StepState, detail?: string) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, state, detail: detail ?? step.detail } : step)));
  }, []);

  const settle = useCallback(() => {
    if (!timer.current && queue.current.length === 0) return Promise.resolve();
    return new Promise<void>((resolve) => waiters.current.push(resolve));
  }, []);

  const reset = useCallback(() => {
    queue.current = [];
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setNodes(freshNodes());
    setSteps(plan.map((step) => ({ ...step, state: "todo" as StepState })));
  }, [plan]);

  return { nodes, steps, listener, mark, settle, reset };
}

export const encryptPlan: StepPlan[] = [
  { id: "encrypt", label: "Encrypt in this browser" },
  { id: "split", label: "Split the key 3-of-5" },
  { id: "wrap", label: "Seal each share to one ORK node" },
  { id: "attest", label: "Network checks policy and attests" },
  { id: "upload", label: "Store ciphertext on the backend" },
];

export const decryptPlan: StepPlan[] = [
  { id: "fetch", label: "Fetch the sealed paper" },
  { id: "release", label: "Ask 5 ORK nodes for key shares" },
  { id: "combine", label: "Rebuild the key from any 3" },
  { id: "decrypt", label: "Open the paper in this browser" },
  { id: "verify", label: "Check digest and attestations" },
];
