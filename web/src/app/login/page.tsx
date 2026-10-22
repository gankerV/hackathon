"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark, homeFor } from "@/components/app/Header";
import { Alert, Avatar, Button, NodeRing, mainRole } from "@/components/ui";
import type { NodeView, Persona } from "@/components/ui";
import { errorText } from "@/lib/format";
import { getDemoUsers, signIn } from "@/lib/tide";
import styles from "./page.module.css";

const groupTitles: Record<string, string> = { admin: "Admin", teacher: "Teacher", student: "Student" };
const order = [2, 4, 1];

function idleNodes(): NodeView[] {
  return [1, 2, 3, 4, 5].map((id) => ({ id, state: "idle" }));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default function LoginPage() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"choose" | "verify">("choose");
  const [accounts, setAccounts] = useState<Persona[] | null>(null);
  const [nodes, setNodes] = useState<NodeView[]>(idleNodes);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const cancelled = useRef(false);

  useEffect(() => {
    if (!open || accounts) return;
    getDemoUsers()
      .then(setAccounts)
      .catch((error) => {
        setAccounts([]);
        setProblem(errorText(error));
      });
  }, [open, accounts]);

  function close() {
    cancelled.current = true;
    setOpen(false);
    setStep("choose");
    setNodes(idleNodes());
    setDone(false);
  }

  async function verify(account: Persona) {
    cancelled.current = false;
    setProblem(null);
    setStep("verify");
    setDone(false);
    setNodes(idleNodes().map((node) => ({ ...node, state: "pending" })));
    const login = signIn(account.username).then(
      () => null,
      (error: unknown) => errorText(error),
    );
    for (const id of order) {
      await wait(450);
      if (cancelled.current) return;
      setNodes((current) => current.map((node) => (node.id === id ? { ...node, state: "ok" } : node)));
    }
    const failure = await login;
    if (cancelled.current) return;
    if (failure) {
      setProblem(failure);
      setStep("choose");
      setNodes(idleNodes());
      return;
    }
    setDone(true);
    await wait(250);
    if (!cancelled.current) router.push(homeFor(account.roles));
  }

  const groups = ["admin", "teacher", "student"].map((role) => ({ role, people: (accounts ?? []).filter((account) => mainRole(account.roles) === role) }));

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <BrandMark />
        <h1 className={styles.title}>Sign in</h1>
        <p className="muted">Passwordless sign-in with Tide</p>
        <Button size="lg" onClick={() => { cancelled.current = false; setOpen(true); }}>
          Sign in with Tide
        </Button>
      </div>
      {open ? (
        <div className={styles.backdrop} role="presentation">
          <div className={styles.panel} role="dialog" aria-modal="true" aria-labelledby="tide-title">
            <div className={styles.panelHead}>
              <span id="tide-title" className={styles.panelTitle}>Tide · secure sign-in (simulated)</span>
              <button type="button" className={styles.cancel} onClick={close}>
                Cancel
              </button>
            </div>
            {step === "choose" ? (
              <div className={styles.body}>
                <h2 className={styles.stepTitle}>Choose account</h2>
                {problem ? <Alert tone="danger" title={problem} /> : null}
                {accounts === null ? <p className="muted">Loading…</p> : null}
                {groups.map((group) =>
                  group.people.length ? (
                    <div key={group.role} className={styles.group}>
                      <span className="eyebrow">{groupTitles[group.role]}</span>
                      {group.people.map((account) => (
                        <button key={account.username} type="button" className={styles.account} onClick={() => verify(account)}>
                          <Avatar name={account.name} role={group.role} size="sm" />
                          <span className={styles.accountText}>
                            <span>{account.name}</span>
                            <span className="mono">{account.username}</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null,
                )}
              </div>
            ) : (
              <div className={styles.body}>
                <h2 className={styles.stepTitle}>{done ? "Signed in" : "Verifying"}</h2>
                <NodeRing nodes={nodes} threshold={3} okLabel="Verified" showList={false} small />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
