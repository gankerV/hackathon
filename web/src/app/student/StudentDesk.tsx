"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExamSheet } from "@/components/app/ExamSheet";
import { SlotList } from "@/components/app/SlotList";
import { ThresholdPanel } from "@/components/app/ThresholdPanel";
import { decryptPlan, useVaultRun } from "@/components/app/useVaultRun";
import styles from "@/components/app/Workspace.module.css";
import { Alert, Badge, Button, Card, Countdown, Icon } from "@/components/ui";
import { ApiError, getClasses, getExam, getMyPolicy, getSlots, sendAudit } from "@/lib/api";
import type { ClassRoom, Slot } from "@/lib/api";
import { useServerClock } from "@/lib/clock";
import { errorText, formatDateTime, formatTime } from "@/lib/format";
import { readPaper } from "@/lib/paper";
import type { ExamPaper } from "@/lib/paper";
import { VaultError, useTide } from "@/lib/tide";

function liveStatus(slot: Slot, now: number): Slot["status"] {
  if (now < new Date(slot.startsAt).getTime()) return "upcoming";
  if (now < new Date(slot.endsAt).getTime()) return "open";
  return "closed";
}

export function StudentDesk() {
  const { user, doDecrypt } = useTide();
  const { now, synced } = useServerClock();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "danger" | "refused" | "warn" | "info"; title: string; text?: string } | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const run = useVaultRun(decryptPlan);

  const load = useCallback(async () => {
    try {
      const [slotList, classList] = await Promise.all([getSlots(), getClasses()]);
      setSlots(slotList);
      setClasses(classList);
      setLoadError(null);
      setSelected((current) => current ?? slotList.find((item) => item.status !== "closed")?.id ?? slotList[0]?.id ?? null);
    } catch (error) {
      setLoadError(errorText(error));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const live = useMemo(() => slots.map((slot) => ({ ...slot, status: liveStatus(slot, now) })), [slots, now]);
  const slot = live.find((item) => item.id === selected) ?? null;
  const room = classes.find((item) => item.id === slot?.classId);

  function pick(id: string) {
    setSelected(id);
    setNotice(null);
    setPaper(null);
    run.reset();
  }

  async function open() {
    if (!slot) return;
    setBusy(true);
    setNotice(null);
    setPaper(null);
    run.reset();
    try {
      run.mark("fetch", "active");
      const exam = await getExam(slot.id);
      run.mark("fetch", "done", `Sealed by ${exam.uploadedBy}`);
      const policy = await getMyPolicy(slot.id);
      const text = await doDecrypt(exam, slot.id, policy, run.listener);
      await run.settle();
      setPaper(readPaper(text));
      sendAudit("exam.decrypt.ok", slot.id, { by: user?.username, audience: "class" });
    } catch (error) {
      await run.settle();
      if (error instanceof ApiError) {
        run.mark("fetch", "failed", error.message);
        if (error.status === 425) setNotice({ tone: "refused", title: "Not yet: the exam is still sealed", text: `The server clock says ${formatTime(String(error.data.now ?? now))}. The paper opens at ${formatTime(String(error.data.opensAt ?? slot.startsAt))}.` });
        else if (error.status === 410) setNotice({ tone: "info", title: "This exam has ended", text: "The paper is no longer released to students." });
        else if (error.status === 404) setNotice({ tone: "warn", title: "Nothing to open yet", text: error.message });
        else setNotice({ tone: "danger", title: "Could not fetch the paper", text: error.message });
      } else if (error instanceof VaultError) {
        setNotice({ tone: "refused", title: "Access refused by the network", text: error.message });
      } else {
        setNotice({ tone: "danger", title: "Could not open the paper", text: errorText(error) });
      }
      sendAudit("exam.decrypt.denied", slot.id, { by: user?.username, reason: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  const started = run.steps.some((step) => step.state !== "todo");

  return (
    <div className="page">
      <div className={styles.intro}>
        <span className="eyebrow">Student · {user?.name} · {user?.groups.join(", ")}</span>
        <h1>Your exams</h1>
        <p className="muted">Papers stay sealed until the exam starts. When it does, five independent nodes check that you belong to the class before each one releases a piece of the key.</p>
      </div>
      {loadError ? <Alert tone="danger" title="Backend not reachable">{loadError}</Alert> : null}
      <div className={styles.layout}>
        <aside className={styles.aside}>
          <span className="eyebrow">Class slots</span>
          {live.length === 0 && !loadError ? <p className={styles.empty}>No exams scheduled for your class.</p> : null}
          <SlotList slots={live} classes={classes} selected={selected} onSelect={pick} extra={(item) => (item.hasExam ? <Badge tone="accent">Paper sealed</Badge> : <Badge>No paper yet</Badge>)} />
        </aside>
        <div className={styles.main}>
          {slot ? (
            <>
              <Card tone="paper" eyebrow={`${room ? `Class ${room.name}` : ""} · ${slot.kind}`} title={slot.title}>
                <div className={styles.countdownBlock}>
                  {slot.status === "upcoming" ? (
                    <Countdown target={new Date(slot.startsAt).getTime()} now={now} label="Opens in" size="lg" />
                  ) : slot.status === "open" ? (
                    <Countdown target={new Date(slot.endsAt).getTime()} now={now} label="Time left" size="lg" />
                  ) : (
                    <Countdown target={0} now={now} doneLabel="Exam closed" size="lg" />
                  )}
                  <div className="stack" style={{ gap: "var(--space-1)", alignItems: "flex-end" }}>
                    <span className="mono muted">
                      {formatDateTime(slot.startsAt)} → {formatTime(slot.endsAt)}
                    </span>
                    <span className="mono muted">server time {formatTime(now)}{synced ? "" : " (syncing)"}</span>
                  </div>
                </div>
                <div className="row">
                  <Button size="lg" icon={<Icon name="unlock" />} onClick={open} busy={busy} disabled={busy || slot.status === "closed"} variant={slot.status === "open" ? "primary" : "secondary"}>
                    {slot.status === "open" ? "Open exam paper" : "Try to open now"}
                  </Button>
                  {slot.status === "upcoming" ? <span className="muted">The server and the network will both refuse until the start time.</span> : null}
                  {!slot.policies.class ? <Badge tone="warn">Class policy not signed yet</Badge> : null}
                </div>
              </Card>
              {notice ? <Alert tone={notice.tone} title={notice.title}>{notice.text}</Alert> : null}
              {busy || started ? (
                <ThresholdPanel title="Threshold decryption" eyebrow="5 ORK nodes · threshold 3" nodes={run.nodes} steps={run.steps} okLabel="Released" centerTitle="Key shares" centerNote="No node ever sees the whole key. It is rebuilt only here, in your browser." />
              ) : null}
              {paper ? <ExamSheet paper={paper} slotTitle={slot.title} className={room ? `Class ${room.name}` : undefined} /> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
