"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { statusBadge } from "@/components/app/SlotList";
import { Alert, Badge, Button, Card, Input, Select, Table } from "@/components/ui";
import { createSlot } from "@/lib/api";
import type { Slot } from "@/lib/api";
import { errorText, formatDateTime, toLocalInput, toSeconds } from "@/lib/format";
import { AdminAccess } from "./AdminAccess";
import { proposePolicy } from "./policy";
import styles from "./Admin.module.css";
import type { AdminData } from "./useAdminData";

type Notice = { tone: "ok" | "danger" | "warn"; text: string };

const TEACHER_GRACE = 30 * 24 * 3600;

function defaultForm() {
  const start = new Date(Date.now() + 5 * 60000);
  start.setSeconds(0, 0);
  return { classId: "", title: "Mathematics", kind: "midterm" as "midterm" | "final", teacher: "", startsAt: toLocalInput(start), endsAt: toLocalInput(new Date(start.getTime() + 60 * 60000)) };
}

export function ExamsTab({ data }: { data: AdminData }) {
  const teachers = data.users.filter((item) => item.roles.includes("teacher"));
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState(defaultForm);

  function pendingFor(slot: Slot, label: string) {
    return data.requests.some((request) => {
      const payload = request.payload as Record<string, unknown>;
      return request.type === "policy.sign" && request.status === "PENDING" && payload.assignmentId === slot.id && payload.label === label;
    });
  }

  async function addSlot(event: FormEvent) {
    event.preventDefault();
    setBusy("slot");
    setNotice(null);
    try {
      await createSlot({ ...form, title: form.title.trim(), startsAt: new Date(form.startsAt).toISOString(), endsAt: new Date(form.endsAt).toISOString() });
      setNotice({ tone: "ok", text: "Slot created." });
      await data.loadApi();
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function prepare(slot: Slot) {
    const room = data.classes.find((item) => item.id === slot.classId);
    const teacher = data.users.find((item) => item.username === slot.teacher);
    if (!room || !teacher) {
      setNotice({ tone: "danger", text: "Missing class or teacher for this slot." });
      return;
    }
    setBusy(slot.id);
    setNotice(null);
    try {
      let count = 0;
      if (!slot.policies.teacher && !pendingFor(slot, "teacher")) {
        await proposePolicy({ subjectType: "User", subjectId: teacher.tideuserkey, assignmentId: slot.id, access: "read-write", notBefore: 0, expiry: toSeconds(slot.endsAt) + TEACHER_GRACE, label: "teacher" });
        count += 1;
      }
      if (!slot.policies.class && !pendingFor(slot, "class")) {
        await proposePolicy({ subjectType: "Group", subjectId: room.groupPath, assignmentId: slot.id, access: "read", notBefore: toSeconds(slot.startsAt), expiry: toSeconds(slot.endsAt), label: "class" });
        count += 1;
      }
      setNotice(count ? { tone: "ok", text: `${count} policy request${count > 1 ? "s" : ""} sent to Approvals.` } : { tone: "warn", text: "Policies are already signed or pending." });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  function policyBadge(slot: Slot, label: "teacher" | "class") {
    if (slot.policies[label]) return <Badge tone="ok">{label}</Badge>;
    if (pendingFor(slot, label)) return <Badge tone="warn">{label} pending</Badge>;
    return <Badge>{label} none</Badge>;
  }

  return (
    <div className="stack">
      {data.apiError ? <Alert tone="danger" title={data.apiError} /> : null}
      {notice ? <Alert tone={notice.tone} title={notice.text} /> : null}
      <Card title="New exam slot">
        <form className={styles.slotForm} onSubmit={addSlot}>
          <Select label="Class" value={form.classId} onChange={(event) => setForm({ ...form, classId: event.target.value })} required>
            <option value="">Choose</option>
            {data.classes.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </Select>
          <Select label="Kind" value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as "midterm" | "final" })}>
            <option value="midterm">Midterm</option>
            <option value="final">Final</option>
          </Select>
          <Input label="Title" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <Select label="Teacher" value={form.teacher} onChange={(event) => setForm({ ...form, teacher: event.target.value })} required>
            <option value="">Choose</option>
            {teachers.map((item) => (
              <option key={item.username} value={item.username}>
                {item.name}
              </option>
            ))}
          </Select>
          <Input label="Starts" type="datetime-local" value={form.startsAt} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required />
          <Input label="Ends" type="datetime-local" value={form.endsAt} onChange={(event) => setForm({ ...form, endsAt: event.target.value })} required />
          <Button type="submit" busy={busy === "slot"}>
            Create
          </Button>
        </form>
      </Card>
      <Table<Slot>
        rowKey={(row) => row.id}
        rows={data.slots}
        empty="No exam slots yet."
        columns={[
          { key: "title", label: "Slot", render: (row) => <strong>{row.title}</strong> },
          { key: "class", label: "Class", render: (row) => <span>{data.classes.find((item) => item.id === row.classId)?.name ?? row.classId} · {row.kind}</span> },
          { key: "time", label: "Starts", render: (row) => <span className="mono">{formatDateTime(row.startsAt)}</span> },
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
      <AdminAccess data={data} />
    </div>
  );
}
