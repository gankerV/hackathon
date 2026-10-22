"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExamSheet } from "@/components/app/ExamSheet";
import { RingCard } from "@/components/app/RingCard";
import { SlotList } from "@/components/app/SlotList";
import { useVaultRun } from "@/components/app/useVaultRun";
import styles from "@/components/app/Workspace.module.css";
import { Alert, Badge, Button, Card, Icon, Input, Textarea } from "@/components/ui";
import { ApiError, getClasses, getExam, getMyPolicy, getSlots, sendAudit, uploadExam } from "@/lib/api";
import type { ClassRoom, Slot } from "@/lib/api";
import { errorText } from "@/lib/format";
import { readPaper, writePaper } from "@/lib/paper";
import type { ExamPaper } from "@/lib/paper";
import { VaultError, useTide } from "@/lib/tide";

type Draft = { title: string; questions: string[] };
type Notice = { tone: "ok" | "danger" | "refused" | "warn"; text: string };

export function TeacherDesk() {
  const { user, doEncrypt, doDecrypt } = useTide();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [mode, setMode] = useState<"idle" | "sealing" | "reviewing">("idle");
  const [ringMode, setRingMode] = useState<"seal" | "review">("seal");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [review, setReview] = useState<ExamPaper | null>(null);
  const run = useVaultRun();

  const load = useCallback(async () => {
    try {
      const [slotList, classList] = await Promise.all([getSlots(), getClasses()]);
      setSlots(slotList);
      setClasses(classList);
      setSelected((current) => current ?? slotList[0]?.id ?? null);
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const slot = useMemo(() => slots.find((item) => item.id === selected) ?? null, [slots, selected]);
  const draft = (slot && drafts[slot.id]) || { title: slot ? slot.title : "", questions: ["", ""] };
  const locked = slot ? slot.status !== "upcoming" : true;

  function pick(id: string) {
    setSelected(id);
    setNotice(null);
    setReview(null);
    run.reset();
  }

  function change(next: Partial<Draft>) {
    if (!slot) return;
    setDrafts((current) => ({ ...current, [slot.id]: { ...draft, ...next } }));
  }

  async function seal() {
    if (!slot) return;
    const questions = draft.questions.map((question) => question.trim()).filter(Boolean);
    if (!draft.title.trim() || questions.length === 0) {
      setNotice({ tone: "warn", text: "Add a title and at least one question." });
      return;
    }
    setMode("sealing");
    setRingMode("seal");
    setNotice(null);
    setReview(null);
    run.start();
    try {
      const policy = await getMyPolicy(slot.id);
      const plaintext = writePaper({ title: draft.title.trim(), instructions: "", questions, sealedAt: new Date().toISOString() });
      const result = await doEncrypt(plaintext, slot.id, policy, run.listener);
      await run.settle();
      await uploadExam(slot.id, result);
      setNotice({ tone: "ok", text: "Sealed. The server holds only ciphertext." });
      load();
    } catch (error) {
      await run.settle();
      if (error instanceof ApiError && error.status === 404) setNotice({ tone: "warn", text: "Your policy needs 3 admin approvals first." });
      else if (error instanceof ApiError && error.status === 423) setNotice({ tone: "refused", text: "Locked: the exam has started." });
      else setNotice({ tone: error instanceof VaultError ? "refused" : "danger", text: errorText(error) });
    } finally {
      setMode("idle");
    }
  }

  async function reviewPaper() {
    if (!slot) return;
    setMode("reviewing");
    setRingMode("review");
    setNotice(null);
    setReview(null);
    run.start();
    try {
      const exam = await getExam(slot.id);
      const policy = await getMyPolicy(slot.id);
      const text = await doDecrypt(exam, slot.id, policy, run.listener);
      await run.settle();
      setReview(readPaper(text));
      sendAudit("exam.decrypt.ok", slot.id, { by: user?.username, audience: "teacher" });
    } catch (error) {
      await run.settle();
      setNotice({ tone: error instanceof VaultError ? "refused" : "danger", text: errorText(error) });
      sendAudit("exam.decrypt.denied", slot.id, { by: user?.username, reason: errorText(error) });
    } finally {
      setMode("idle");
    }
  }

  return (
    <div className="page">
      <div className={styles.intro}>
        <h1>Your exams</h1>
        <p className="muted">Papers are encrypted in your browser before upload.</p>
      </div>
      <div className={styles.layout}>
        <aside className={styles.aside}>
          {slots.length === 0 ? <p className={styles.empty}>No exam slots yet.</p> : null}
          <SlotList slots={slots} classes={classes} selected={selected} onSelect={pick} extra={(item) => (item.hasExam ? <Badge tone="accent">Sealed</Badge> : item.policies.teacher ? null : <Badge tone="warn">Needs approval</Badge>)} />
        </aside>
        <div className={styles.main}>
          {slot ? (
            <>
              {notice ? <Alert tone={notice.tone} title={notice.text} /> : null}
              <Card tone="paper" title={slot.title}>
                <Input label="Title" value={draft.title} onChange={(event) => change({ title: event.target.value })} disabled={locked} />
                {draft.questions.map((question, index) => (
                  <div key={index} className={styles.question}>
                    <span className={styles.questionNumber}>{index + 1}.</span>
                    <Textarea label={`Question ${index + 1}`} value={question} rows={2} disabled={locked} onChange={(event) => change({ questions: draft.questions.map((item, position) => (position === index ? event.target.value : item)) })} />
                    <span className={styles.questionRemove}>
                      <Button variant="ghost" size="sm" aria-label={`Remove question ${index + 1}`} disabled={locked || draft.questions.length < 2} onClick={() => change({ questions: draft.questions.filter((_, position) => position !== index) })}>
                        <Icon name="cross" />
                      </Button>
                    </span>
                  </div>
                ))}
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <Button variant="secondary" size="sm" disabled={locked} onClick={() => change({ questions: [...draft.questions, ""] })}>
                    Add question
                  </Button>
                  <div className="row">
                    {slot.hasExam ? (
                      <Button variant="secondary" icon={<Icon name="eye" />} onClick={reviewPaper} busy={mode === "reviewing"} disabled={mode !== "idle"}>
                        Review
                      </Button>
                    ) : null}
                    <Button icon={<Icon name="lock" />} onClick={seal} busy={mode === "sealing"} disabled={locked || mode !== "idle"}>
                      Encrypt &amp; seal
                    </Button>
                  </div>
                </div>
              </Card>
              {run.active ? (
                <RingCard
                  title={ringMode === "seal" ? "Sealing" : "Opening"}
                  nodes={run.nodes}
                  okLabel={ringMode === "seal" ? "Attested" : "Released"}
                  caption={ringMode === "seal" ? `${run.okCount}/5 nodes attested` : `${run.okCount}/5 nodes released a share`}
                />
              ) : null}
              {review ? <ExamSheet paper={review} /> : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
