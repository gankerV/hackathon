"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExamSheet } from "@/components/app/ExamSheet";
import { RingCard } from "@/components/app/RingCard";
import { SlotList } from "@/components/app/SlotList";
import { useVaultRun } from "@/components/app/useVaultRun";
import styles from "@/components/app/Workspace.module.css";
import { Alert, Button, Card, Countdown, Icon } from "@/components/ui";
import { ApiError, getClasses, getExam, getMyPolicy, getSlots, sendAudit } from "@/lib/api";
import type { ClassRoom, Slot } from "@/lib/api";
import { useServerClock } from "@/lib/clock";
import { errorText, formatTime } from "@/lib/format";
import { readPaper } from "@/lib/paper";
import type { ExamPaper } from "@/lib/paper";
import { VaultError, useTide } from "@/lib/tide";

type Notice = { tone: "danger" | "refused" | "warn" | "info"; text: string };

function liveStatus(slot: Slot, now: number): Slot["status"] {
  if (now < new Date(slot.startsAt).getTime()) return "upcoming";
  if (now < new Date(slot.endsAt).getTime()) return "open";
  return "closed";
}

export function StudentDesk() {
  const { user, doDecrypt } = useTide();
  const { now } = useServerClock();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const run = useVaultRun();

  const load = useCallback(async () => {
    try {
      const [slotList, classList] = await Promise.all([getSlots(), getClasses()]);
      setSlots(slotList);
      setClasses(classList);
      setSelected((current) => current ?? slotList.find((item) => item.status !== "closed")?.id ?? slotList[0]?.id ?? null);
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load]);

  const live = useMemo(() => slots.map((slot) => ({ ...slot, status: liveStatus(slot, now) })), [slots, now]);
  const slot = live.find((item) => item.id === selected) ?? null;

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
      const exam = await getExam(slot.id);
      const policy = await getMyPolicy(slot.id);
      run.start();
      const text = await doDecrypt(exam, slot.id, policy, run.listener);
      await run.settle();
      setPaper(readPaper(text));
      sendAudit("exam.decrypt.ok", slot.id, { by: user?.username, audience: "class" });
    } catch (error) {
      await run.settle();
      if (error instanceof ApiError && error.status === 425) setNotice({ tone: "refused", text: `Not open yet. Opens at ${formatTime(String(error.data.opensAt ?? slot.startsAt))}.` });
      else if (error instanceof ApiError && error.status === 410) setNotice({ tone: "info", text: "This exam has ended." });
      else if (error instanceof ApiError && error.status === 404) setNotice({ tone: "warn", text: error.message });
      else setNotice({ tone: error instanceof VaultError ? "refused" : "danger", text: errorText(error) });
      sendAudit("exam.decrypt.denied", slot.id, { by: user?.username, reason: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className={styles.intro}>
        <h1>Your exams</h1>
        <p className="muted">Each paper opens when the exam starts.</p>
      </div>
      <div className={styles.layout}>
        <aside className={styles.aside}>
          {live.length === 0 ? <p className={styles.empty}>No exams scheduled.</p> : null}
          <SlotList slots={live} classes={classes} selected={selected} onSelect={pick} />
        </aside>
        <div className={styles.main}>
          {slot ? (
            <>
              <Card tone="paper" title={slot.title}>
                <div className={styles.countdownBlock}>
                  {slot.status === "upcoming" ? (
                    <Countdown target={new Date(slot.startsAt).getTime()} now={now} label="Opens in" size="lg" />
                  ) : slot.status === "open" ? (
                    <Countdown target={new Date(slot.endsAt).getTime()} now={now} label="Time left" size="lg" />
                  ) : (
                    <Countdown target={0} now={now} doneLabel="Closed" size="lg" />
                  )}
                  <Button size="lg" icon={<Icon name="unlock" />} onClick={open} busy={busy} disabled={busy || slot.status === "closed" || !slot.hasExam} variant={slot.status === "open" ? "primary" : "secondary"}>
                    Open exam
                  </Button>
                </div>
              </Card>
              {notice ? <Alert tone={notice.tone} title={notice.text} /> : null}
              {run.active && !paper ? <RingCard title="Opening" nodes={run.nodes} okLabel="Released" caption={`${run.okCount}/5 nodes released a share`} /> : null}
              {paper ? <ExamSheet paper={paper} /> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
