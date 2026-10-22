"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ExamSheet } from "@/components/app/ExamSheet";
import { SlotList } from "@/components/app/SlotList";
import { ThresholdPanel } from "@/components/app/ThresholdPanel";
import { decryptPlan, encryptPlan, useVaultRun } from "@/components/app/useVaultRun";
import styles from "@/components/app/Workspace.module.css";
import { Alert, Badge, Button, Card, Hash, Icon, Input, Seal, Textarea } from "@/components/ui";
import { ApiError, getClasses, getExam, getMyPolicy, getSlots, sendAudit, uploadExam } from "@/lib/api";
import type { ClassRoom, Slot } from "@/lib/api";
import { errorText, formatDateTime } from "@/lib/format";
import { readPaper, writePaper } from "@/lib/paper";
import type { ExamPaper } from "@/lib/paper";
import { VaultError, useTide } from "@/lib/tide";
import type { SealedExam } from "@/lib/tide";

type Draft = { title: string; instructions: string; questions: string[] };

const blankDraft: Draft = { title: "", instructions: "Answer all questions. Show your working.", questions: ["", ""] };

export function TeacherDesk() {
  const { user, doEncrypt, doDecrypt } = useTide();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [classes, setClasses] = useState<ClassRoom[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [mode, setMode] = useState<"idle" | "sealing" | "reviewing">("idle");
  const [notice, setNotice] = useState<{ tone: "ok" | "danger" | "refused" | "warn"; title: string; text?: string } | null>(null);
  const [sealed, setSealed] = useState<SealedExam | null>(null);
  const [review, setReview] = useState<ExamPaper | null>(null);
  const sealRun = useVaultRun(encryptPlan);
  const reviewRun = useVaultRun(decryptPlan);

  const load = useCallback(async () => {
    try {
      const [slotList, classList] = await Promise.all([getSlots(), getClasses()]);
      setSlots(slotList);
      setClasses(classList);
      setLoadError(null);
      setSelected((current) => current ?? slotList[0]?.id ?? null);
    } catch (error) {
      setLoadError(errorText(error));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const slot = useMemo(() => slots.find((item) => item.id === selected) ?? null, [slots, selected]);
  const room = classes.find((item) => item.id === slot?.classId);
  const draft = (slot && drafts[slot.id]) || { ...blankDraft, title: slot ? slot.title : "" };

  function pick(id: string) {
    setSelected(id);
    setNotice(null);
    setSealed(null);
    setReview(null);
    setMode("idle");
    sealRun.reset();
    reviewRun.reset();
  }

  function change(next: Partial<Draft>) {
    if (!slot) return;
    setDrafts((current) => ({ ...current, [slot.id]: { ...draft, ...next } }));
  }

  async function seal() {
    if (!slot) return;
    const questions = draft.questions.map((question) => question.trim()).filter(Boolean);
    if (!draft.title.trim() || questions.length === 0) {
      setNotice({ tone: "warn", title: "Add a title and at least one question first." });
      return;
    }
    setMode("sealing");
    setNotice(null);
    setReview(null);
    reviewRun.reset();
    sealRun.reset();
    try {
      const policy = await getMyPolicy(slot.id);
      const plaintext = writePaper({ title: draft.title.trim(), instructions: draft.instructions.trim(), questions, sealedAt: new Date().toISOString() });
      const result = await doEncrypt(plaintext, slot.id, policy, sealRun.listener);
      await sealRun.settle();
      sealRun.mark("upload", "active");
      await uploadExam(slot.id, result);
      sealRun.mark("upload", "done", "Backend checked 3+ attestations and the digest");
      setSealed(result);
      setNotice({ tone: "ok", title: "Paper sealed and stored", text: "Only ciphertext left this browser. The key now exists only as 5 shares on the ORK network." });
      setDrafts((current) => {
        const next = { ...current };
        delete next[slot.id];
        return next;
      });
      load();
    } catch (error) {
      await sealRun.settle();
      if (error instanceof ApiError && error.status === 404) setNotice({ tone: "warn", title: "No signed policy for you on this slot yet", text: "Three admins must approve the teacher policy before the network will attest your paper." });
      else if (error instanceof ApiError && error.status === 423) {
        sealRun.mark("upload", "failed", "Exam already started");
        setNotice({ tone: "refused", title: "Locked: the exam has started", text: "Papers cannot be replaced once the slot opens." });
      } else if (error instanceof VaultError) setNotice({ tone: "refused", title: "The network refused to attest", text: error.message });
      else {
        sealRun.mark("upload", "failed");
        setNotice({ tone: "danger", title: "Sealing failed", text: errorText(error) });
      }
    } finally {
      setMode("idle");
    }
  }

  async function reviewPaper() {
    if (!slot) return;
    setMode("reviewing");
    setNotice(null);
    setReview(null);
    reviewRun.reset();
    try {
      reviewRun.mark("fetch", "active");
      const exam = await getExam(slot.id);
      reviewRun.mark("fetch", "done", `Ciphertext from ${exam.uploadedBy} at ${formatDateTime(exam.uploadedAt)}`);
      const policy = await getMyPolicy(slot.id);
      const text = await doDecrypt(exam, slot.id, policy, reviewRun.listener);
      await reviewRun.settle();
      setReview(readPaper(text));
      sendAudit("exam.decrypt.ok", slot.id, { by: user?.username, audience: "teacher" });
    } catch (error) {
      await reviewRun.settle();
      if (error instanceof ApiError) reviewRun.mark("fetch", "failed", error.message);
      setNotice({ tone: error instanceof VaultError ? "refused" : "danger", title: error instanceof VaultError ? "The network refused" : "Could not open the paper", text: errorText(error) });
      sendAudit("exam.decrypt.denied", slot.id, { by: user?.username, reason: errorText(error) });
    } finally {
      setMode("idle");
    }
  }

  const locked = slot ? slot.status !== "upcoming" : true;

  return (
    <div className="page">
      <div className={styles.intro}>
        <span className="eyebrow">Teacher · {user?.name}</span>
        <h1>Seal your exam papers</h1>
        <p className="muted">Write the paper here. It is encrypted in this browser before it goes anywhere. The school&apos;s server only ever stores ciphertext, and it cannot let anyone else read it.</p>
      </div>
      {loadError ? <Alert tone="danger" title="Backend not reachable">{loadError}</Alert> : null}
      <div className={styles.layout}>
        <aside className={styles.aside}>
          <span className="eyebrow">Your slots</span>
          {slots.length === 0 && !loadError ? <p className={styles.empty}>No exam slots assigned to you yet. An admin creates slots under Classes &amp; exams.</p> : null}
          <SlotList
            slots={slots}
            classes={classes}
            selected={selected}
            onSelect={pick}
            extra={(item) => (
              <>
                {item.policies.teacher ? <Badge tone="ok">Policy signed</Badge> : <Badge tone="warn">Awaiting quorum</Badge>}
                {item.hasExam ? <Badge tone="accent">Sealed</Badge> : <Badge>Not sealed</Badge>}
              </>
            )}
          />
        </aside>
        <div className={styles.main}>
          {!slot ? null : (
            <>
              {!slot.policies.teacher ? (
                <Alert tone="warn" title="Your teacher policy is not signed yet">
                  Three admins must approve it in Approvals. Until then the ORK network will refuse to attest this paper.
                </Alert>
              ) : null}
              {notice ? <Alert tone={notice.tone} title={notice.title}>{notice.text}</Alert> : null}

              <Card
                tone="paper"
                eyebrow={`${room ? `Class ${room.name}` : ""} · ${slot.kind} · opens ${formatDateTime(slot.startsAt)}`}
                title={slot.hasExam ? "Replace the sealed paper" : "Exam editor"}
                actions={
                  slot.hasExam ? (
                    <Button variant="secondary" icon={<Icon name="eye" />} onClick={reviewPaper} busy={mode === "reviewing"} disabled={mode !== "idle"}>
                      Review my exam
                    </Button>
                  ) : null
                }
              >
                <Input label="Paper title" value={draft.title} onChange={(event) => change({ title: event.target.value })} placeholder="Mathematics midterm, 10A" disabled={locked} />
                <Textarea label="Instructions" value={draft.instructions} onChange={(event) => change({ instructions: event.target.value })} rows={2} disabled={locked} />
                {draft.questions.map((question, index) => (
                  <div key={index} className={styles.question}>
                    <span className={styles.questionNumber}>{index + 1}.</span>
                    <Textarea
                      label={`Question ${index + 1}`}
                      value={question}
                      rows={2}
                      disabled={locked}
                      onChange={(event) => change({ questions: draft.questions.map((item, position) => (position === index ? event.target.value : item)) })}
                    />
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
                  <Button size="lg" icon={<Icon name="lock" />} onClick={seal} busy={mode === "sealing"} disabled={locked || mode !== "idle"}>
                    Encrypt &amp; seal
                  </Button>
                </div>
                {locked ? <Alert tone="info" title="Editing is closed">The exam slot has opened, so the sealed paper can no longer be replaced.</Alert> : null}
              </Card>

              {mode === "sealing" || sealRun.steps.some((step) => step.state !== "todo") ? (
                <ThresholdPanel title="Sealing with the ORK network" eyebrow="Threshold encryption" nodes={sealRun.nodes} steps={sealRun.steps} okLabel="Attested" centerTitle="Node attestations" centerNote="Each node checks your signed policy, then signs the paper's digest.">
                  {sealed ? (
                    <div className={styles.sealedHead}>
                      <Seal label="Sealed" sub={slot.id.slice(0, 10).toUpperCase()} size={92} />
                      <dl className={styles.storage}>
                        <dt>Digest</dt>
                        <dd><Hash value={sealed.digest} head={18} tail={8} label="Digest" /></dd>
                        <dt>Attested by</dt>
                        <dd>{sealed.attestations.map((item) => `ORK ${item.node}`).join(", ")}</dd>
                        <dt>Server stores</dt>
                        <dd className={styles.cipher}>{sealed.bundle.ciphertext}</dd>
                      </dl>
                    </div>
                  ) : null}
                </ThresholdPanel>
              ) : null}

              {mode === "reviewing" || review || reviewRun.steps.some((step) => step.state !== "todo") ? (
                <ThresholdPanel title="Opening your sealed paper" eyebrow="Threshold decryption" nodes={reviewRun.nodes} steps={reviewRun.steps} okLabel="Released" centerTitle="Key shares" centerNote="Any 3 of 5 nodes rebuild the key, in your browser only." />
              ) : null}
              {review ? <ExamSheet paper={review} slotTitle={slot.title} className={room ? `Class ${room.name}` : undefined} note="Teacher review copy, decrypted in this browser with your read-write policy." /> : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
