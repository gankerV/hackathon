"use client";

import { useState } from "react";
import { Alert, Avatar, Button, Card, Icon, QuorumMeter } from "@/components/ui";
import { sendAudit } from "@/lib/api";
import { errorText } from "@/lib/format";
import { ADMIN_THRESHOLD, approveChangeRequest, getChangeRequests, rejectChangeRequest, signIn, useTide } from "@/lib/tide";
import type { ChangeRequest } from "@/lib/tide";
import { describeRequest } from "./describe";
import { storePolicy } from "./policy";
import styles from "./Admin.module.css";
import type { AdminData } from "./useAdminData";

type Notice = { tone: "ok" | "danger" | "info"; text: string };

export function ApprovalsTab({ data }: { data: AdminData }) {
  const { user } = useTide();
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const pending = data.requests.filter((item) => item.status === "PENDING");

  async function approve(request: ChangeRequest) {
    setBusy(request.id);
    setNotice(null);
    try {
      const answer = await approveChangeRequest(request.id);
      const latest = answer && answer.status ? answer : (await getChangeRequests()).find((item) => item.id === request.id);
      const count = latest?.approvals.length ?? request.approvals.length + 1;
      sendAudit("cr.approve", request.id, { type: request.type, approvals: count, status: latest?.status });
      if (latest?.status === "COMMITTED") {
        if (latest.type === "policy.sign") {
          await storePolicy(latest);
          data.loadApi();
        }
        setNotice({ tone: "ok", text: `Approved ${ADMIN_THRESHOLD}/${ADMIN_THRESHOLD}. Change applied.` });
      } else {
        setNotice({ tone: "info", text: `Approved ${count}/${ADMIN_THRESHOLD}.` });
      }
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function reject(request: ChangeRequest) {
    setBusy(request.id);
    setNotice(null);
    try {
      await rejectChangeRequest(request.id);
      sendAudit("cr.reject", request.id, { type: request.type });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      {notice ? <Alert tone={notice.tone} title={notice.text} /> : null}
      {pending.length === 0 ? <p className={styles.empty}>No pending requests.</p> : null}
      {pending.map((request) => {
        const signed = request.approvals.some((item) => item.username === user?.username);
        const nextAdmins = data.admins.filter((admin) => admin.username !== user?.username && !request.approvals.some((item) => item.username === admin.username));
        return (
          <Card key={request.id} as="article" tone="paper" title={describeRequest(request, data.users, data.slots, data.classes)}>
            <QuorumMeter approvals={request.approvals} threshold={ADMIN_THRESHOLD} status={request.status} names={data.names} compact />
            <div className={styles.approveRow}>
              <div className="row">
                <Button icon={<Icon name="check" />} onClick={() => approve(request)} busy={busy === request.id} disabled={signed || busy !== null}>
                  {signed ? "Approved" : "Approve"}
                </Button>
                <Button variant="danger" onClick={() => reject(request)} disabled={busy !== null}>
                  Reject
                </Button>
              </div>
              {nextAdmins.length ? (
                <div className={styles.switchRow}>
                  {nextAdmins.map((admin) => (
                    <button key={admin.username} type="button" className={styles.switchChip} onClick={() => signIn(admin.username)}>
                      <Avatar name={admin.name} role="admin" size="sm" />
                      Sign in as {admin.name}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
