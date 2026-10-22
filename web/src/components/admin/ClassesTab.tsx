"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { statusBadge } from "@/components/app/SlotList";
import { Alert, Badge, Button, Card, Input, Select, Table } from "@/components/ui";
import { createClass, createSlot } from "@/lib/api";
import type { ClassRoom, Slot } from "@/lib/api";
import { errorText, formatDateTime, toLocalInput, toSeconds } from "@/lib/format";
import { ADMIN_THRESHOLD } from "@/lib/tide";
import { proposePolicy } from "./policy";
import styles from "./Admin.module.css";
import type { AdminData } from "./useAdminData";

type Notice = { tone: "ok" | "danger" | "warn"; title: string; text?: string };

const TEACHER_GRACE = 30 * 24 * 3600;

export function ClassesTab({ data, onProposed }: { data: AdminData; onProposed: () => void }) {
  const teachers = data.users.filter((item) => item.roles.includes("teacher"));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [className, setClassName] = useState("");
  const [groupPath, setGroupPath] = useState("");
  const [slotForm, setSlotForm] = useState(() => {
    const start = new Date(Date.now() + 5 * 60000);
    start.setSeconds(0, 0);
    return { classId: "", title: "Mathematics", kind: "midterm" as "midterm" | "final", teacher: "", startsAt: toLocalInput(start), endsAt: toLocalInput(new Date(start.getTime() + 60 * 60000)) };
  });

  function pendingFor(slot: Slot, label: string) {
    return data.requests.some((request) => request.type === "policy.sign" && request.status === "PENDING" && (request.payload as Record<string, unknown>).assignmentId === slot.id && (request.payload as Record<string, unknown>).label === label);
  }

  async function addClass(event: FormEvent) {
    event.preventDefault();
    setBusy("class");
    try {
      await createClass(className.trim(), groupPath.trim());
      setClassName("");
      setGroupPath("");
      setNotice({ tone: "ok", title: "Class created" });
      await data.loadApi();
    } catch (error) {
      setNotice({ tone: "danger", title: "Could not create the class", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function addSlot(event: FormEvent) {
    event.preventDefault();
    setBusy("slot");
    try {
      const slot = await createSlot({ ...slotForm, title: slotForm.title.trim(), startsAt: new Date(slotForm.startsAt).toISOString(), endsAt: new Date(slotForm.endsAt).toISOString() });
      setNotice({ tone: "ok", title: `Slot created${slot && slot.id ? `: ${slot.id}` : ""}`, text: "Next, prepare its policies so the teacher can seal and the class can open." });
      await data.loadApi();
    } catch (error) {
      setNotice({ tone: "danger", title: "Could not create the slot", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function prepare(slot: Slot) {
    const room = data.classes.find((item) => item.id === slot.classId);
    const teacher = data.users.find((item) => item.username === slot.teacher);
    if (!room || !teacher) {
      setNotice({ tone: "danger", title: "Missing class or teacher for this slot" });
      return;
    }
    setBusy(slot.id);
    setNotice(null);
    try {
      const created: string[] = [];
      if (!slot.policies.teacher && !pendingFor(slot, "teacher")) {
        const request = await proposePolicy({ subjectType: "User", subjectId: teacher.tideuserkey, assignmentId: slot.id, access: "read-write", notBefore: 0, expiry: toSeconds(slot.endsAt) + TEACHER_GRACE, label: "teacher" });
        created.push(request.id);
      }
      if (!slot.policies.class && !pendingFor(slot, "class")) {
        const request = await proposePolicy({ subjectType: "Group", subjectId: room.groupPath, assignmentId: slot.id, access: "read", notBefore: toSeconds(slot.startsAt), expiry: toSeconds(slot.endsAt), label: "class" });
        created.push(request.id);
      }
      setNotice(created.length ? { tone: "ok", title: `Proposed ${created.length} policy request${created.length > 1 ? "s" : ""}`, text: `Teacher: read-write for ${teacher.name}. Class: read-only for ${room.groupPath}, valid only between the start and end of the exam. Each needs ${ADMIN_THRESHOLD} approvals.` } : { tone: "warn", title: "Policies already signed or waiting for approval" });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", title: "Could not propose policies", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  function policyBadge(slot: Slot, label: "teacher" | "class") {
    if (slot.policies[label]) return <Badge tone="ok">{label} signed</Badge>;
    if (pendingFor(slot, label)) return <Badge tone="warn">{label} pending</Badge>;
    return <Badge>{label} none</Badge>;
  }

  return (
    <div className="stack">
      {data.apiError ? <Alert tone="danger" title="Backend not reachable">{data.apiError}</Alert> : null}
      {notice ? (
        <Alert tone={notice.tone} title={notice.title} action={notice.title.startsWith("Proposed") ? <Button size="sm" variant="secondary" onClick={onProposed}>Go to approvals</Button> : undefined}>
          {notice.text}
        </Alert>
      ) : null}
      <Table<Slot>
        rowKey={(row) => row.id}
        rows={data.slots}
        empty="No exam slots yet. Create one below."
        columns={[
          { key: "title", label: "Slot", render: (row) => <span><strong>{row.title}</strong><br /><span className="mono muted">{row.id}</span></span> },
          { key: "class", label: "Class", render: (row) => <span>{data.classes.find((item) => item.id === row.classId)?.name ?? row.classId} · {row.kind}</span> },
          { key: "teacher", label: "Teacher", render: (row) => <span className="mono">{row.teacher}</span> },
          { key: "time", label: "Window", render: (row) => <span className="mono">{formatDateTime(row.startsAt)}<br />→ {formatDateTime(row.endsAt)}</span> },
          { key: "status", label: "Status", render: (row) => <span className={styles.badges}>{statusBadge(row.status)}{row.hasExam ? <Badge tone="accent">sealed</Badge> : null}</span> },
          { key: "policies", label: "Policies", render: (row) => <span className={styles.badges}>{policyBadge(row, "teacher")}{policyBadge(row, "class")}</span> },
          {
            key: "act",
            label: "",
            render: (row) => (
              <Button size="sm" variant="secondary" onClick={() => prepare(row)} busy={busy === row.id} disabled={busy !== null || (row.policies.teacher && row.policies.class)}>
                Prepare policies
              </Button>
            ),
          },
        ]}
      />
      <div className={styles.formGrid}>
        <Card title="New exam slot" eyebrow="One midterm and one final per class">
          <form className="stack" onSubmit={addSlot}>
            <div className={styles.pair}>
              <Select label="Class" value={slotForm.classId} onChange={(event) => setSlotForm({ ...slotForm, classId: event.target.value })} required>
                <option value="">Choose</option>
                {data.classes.map((room: ClassRoom) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.groupPath})
                  </option>
                ))}
              </Select>
              <Select label="Kind" value={slotForm.kind} onChange={(event) => setSlotForm({ ...slotForm, kind: event.target.value as "midterm" | "final" })}>
                <option value="midterm">Midterm</option>
                <option value="final">Final</option>
              </Select>
            </div>
            <Input label="Title" value={slotForm.title} onChange={(event) => setSlotForm({ ...slotForm, title: event.target.value })} required />
            <Select label="Teacher" value={slotForm.teacher} onChange={(event) => setSlotForm({ ...slotForm, teacher: event.target.value })} required>
              <option value="">Choose</option>
              {teachers.map((item) => (
                <option key={item.username} value={item.username}>
                  {item.name} ({item.username})
                </option>
              ))}
            </Select>
            <div className={styles.pair}>
              <Input label="Starts" type="datetime-local" value={slotForm.startsAt} onChange={(event) => setSlotForm({ ...slotForm, startsAt: event.target.value })} required />
              <Input label="Ends" type="datetime-local" value={slotForm.endsAt} onChange={(event) => setSlotForm({ ...slotForm, endsAt: event.target.value })} required />
            </div>
            <Button type="submit" busy={busy === "slot"}>
              Create slot
            </Button>
          </form>
        </Card>
        <Card title="New class" eyebrow="Linked to a Tide group">
          <form className="stack" onSubmit={addClass}>
            <Input label="Name" value={className} onChange={(event) => setClassName(event.target.value)} placeholder="11A" required />
            <Input label="Group path" value={groupPath} onChange={(event) => setGroupPath(event.target.value)} placeholder="/class-11a" mono required hint="Students join the class through a quorum-approved group change." />
            <Button type="submit" variant="secondary" busy={busy === "class"}>
              Create class
            </Button>
          </form>
          <ul className={styles.classList}>
            {data.classes.map((room) => (
              <li key={room.id}>
                <strong>{room.name}</strong> <span className="mono muted">{room.groupPath}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
