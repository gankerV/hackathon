"use client";

import { useState } from "react";
import { Alert, Avatar, Badge, Button, Card, Icon, QuorumMeter } from "@/components/ui";
import { ApiError, sendAudit } from "@/lib/api";
import { errorText, formatDateTime } from "@/lib/format";
import { ADMIN_THRESHOLD, approveChangeRequest, getChangeRequests, rejectChangeRequest, signIn, useTide } from "@/lib/tide";
import type { ChangeRequest } from "@/lib/tide";
import { requestSummary, requestTitle } from "./describe";
import { audienceOf, storePolicy } from "./policy";
import styles from "./Admin.module.css";
import type { AdminData } from "./useAdminData";

type Notice = { tone: "ok" | "danger" | "warn" | "info"; title: string; text?: string };

export function ApprovalsTab({ data }: { data: AdminData }) {
  const { user } = useTide();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const pending = data.requests.filter((item) => item.status === "PENDING");
  const done = data.requests.filter((item) => item.status !== "PENDING").slice(0, 8);

  async function store(request: ChangeRequest) {
    try {
      const { slotId, audience } = await storePolicy(request);
      setNotice({ tone: "ok", title: `Quorum reached. Signed ${audience} policy stored for slot ${slotId}.`, text: "The backend verified the network signature before saving it." });
      data.loadApi();
    } catch (error) {
      setNotice({ tone: error instanceof ApiError && error.status === 409 ? "info" : "danger", title: "Could not store the signed policy", text: errorText(error) });
    }
  }

  async function approve(request: ChangeRequest) {
    setBusy(request.id);
    setNotice(null);
    try {
      const answer = await approveChangeRequest(request.id);
      const latest = answer && answer.status ? answer : (await getChangeRequests()).find((item) => item.id === request.id);
      const count = latest?.approvals.length ?? request.approvals.length + 1;
      sendAudit("cr.approve", request.id, { type: request.type, approvals: count, status: latest?.status });
      if (latest?.status === "COMMITTED") {
        if (latest.type === "policy.sign") await store(latest);
        else setNotice({ tone: "ok", title: "Quorum reached. Change applied by the network.", text: "Affected users get the new roles on their next sign-in." });
      } else {
        setNotice({ tone: "info", title: `Your approval is recorded: ${count}/${ADMIN_THRESHOLD}`, text: "Switch to another admin to add the next signature." });
      }
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", title: "Approval not accepted", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function reject(request: ChangeRequest) {
    setBusy(request.id);
    try {
      await rejectChangeRequest(request.id);
      sendAudit("cr.reject", request.id, { type: request.type });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", title: "Could not reject", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className={styles.lead}>
        <p className="muted">Every change to roles, groups or exam access is a change request. Nothing happens until {ADMIN_THRESHOLD} different admins sign it. No admin, including the one who proposed it, can push it through alone.</p>
      </div>
      {notice ? <Alert tone={notice.tone} title={notice.title}>{notice.text}</Alert> : null}
      {pending.length === 0 ? <p className={styles.empty}>No pending requests. Propose one from Users &amp; roles, Classes &amp; exams or Access to exam.</p> : null}
      {pending.map((request) => {
        const signed = request.approvals.some((item) => item.username === user?.username);
        const nextAdmins = data.admins.filter((admin) => admin.username !== user?.username && !request.approvals.some((item) => item.username === admin.username));
        return (
          <Card key={request.id} as="article" tone="paper" eyebrow={`${request.type} · ${request.id}`} title={requestTitle(request)} actions={<Badge tone="warn" dot>Pending</Badge>}>
            <p>{requestSummary(request, data.users, data.slots, data.classes)}</p>
            <p className="muted" style={{ fontSize: "var(--text-sm)" }}>
              Proposed by {data.names[request.createdBy] ?? request.createdBy} · {formatDateTime(request.createdAt)}
            </p>
            <QuorumMeter approvals={request.approvals} threshold={ADMIN_THRESHOLD} status={request.status} names={data.names} />
            <div className={styles.approveRow}>
              <div className="row">
                <Button icon={<Icon name="check" />} onClick={() => approve(request)} busy={busy === request.id} disabled={signed || busy !== null}>
                  {signed ? "You signed this" : `Approve as ${user?.name}`}
                </Button>
                <Button variant="danger" onClick={() => reject(request)} disabled={busy !== null}>
                  Reject
                </Button>
              </div>
              {nextAdmins.length ? (
                <div className={styles.switchRow}>
                  <span className="eyebrow">Next signer</span>
                  {nextAdmins.map((admin) => (
                    <button key={admin.username} type="button" className={styles.switchChip} onClick={() => signIn(admin.username)}>
                      <Avatar name={admin.name} role="admin" size="sm" />
                      {admin.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>
        );
      })}
      {done.length ? (
        <div className="stack">
          <h3>Recently decided</h3>
          {done.map((request) => {
            const audience = request.type === "policy.sign" ? audienceOf(request) : null;
            const slot = data.slots.find((item) => item.id === (request.payload as Record<string, unknown>).assignmentId);
            const stored = audience && slot && audience !== "admin" ? slot.policies[audience] : null;
            return (
              <Card key={request.id} as="article" eyebrow={`${request.type} · ${request.id}`} title={requestTitle(request)} actions={request.status === "COMMITTED" ? <Badge tone="ok" dot>Committed</Badge> : <Badge tone="neutral">Rejected</Badge>}>
                <p>{requestSummary(request, data.users, data.slots, data.classes)}</p>
                <QuorumMeter approvals={request.approvals} threshold={ADMIN_THRESHOLD} status={request.status} names={data.names} compact />
                {request.status === "COMMITTED" && request.type === "policy.sign" ? (
                  <div className="row">
                    {stored ? <Badge tone="ok">Stored on backend</Badge> : null}
                    <Button variant="secondary" size="sm" onClick={() => store(request)}>
                      {stored ? "Store again" : "Store signed policy"}
                    </Button>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
