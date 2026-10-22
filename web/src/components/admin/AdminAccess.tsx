"use client";

import { useEffect, useState } from "react";
import { CipherView } from "@/components/app/CipherView";
import { ExamSheet } from "@/components/app/ExamSheet";
import { useVaultRun } from "@/components/app/useVaultRun";
import { Alert, Button, Card, Icon, NodeRing, Select } from "@/components/ui";
import { ApiError, getExam, getMyPolicy, sendAudit } from "@/lib/api";
import type { StoredExam } from "@/lib/api";
import { errorText } from "@/lib/format";
import { readPaper } from "@/lib/paper";
import type { ExamPaper } from "@/lib/paper";
import { toBase64 } from "@/lib/tide/bytes";
import { VaultError, makeDecoyShares, releaseShares, useTide } from "@/lib/tide";
import type { SignedPolicy } from "@/lib/tide";
import { proposeChange, proposePolicy } from "./policy";
import styles from "./Admin.module.css";
import type { AdminData } from "./useAdminData";

type Notice = { tone: "ok" | "danger" | "warn" | "refused"; text: string };

export function AdminAccess({ data }: { data: AdminData }) {
  const { user, hasRole, doDecrypt } = useTide();
  const [slotId, setSlotId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [ringMode, setRingMode] = useState<"open" | "forged">("open");
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const [sealed, setSealed] = useState<StoredExam | null>(null);
  const run = useVaultRun();

  useEffect(() => {
    if (!slotId && data.slots.length) setSlotId((data.slots.find((item) => item.hasExam) ?? data.slots[0]).id);
  }, [data.slots, slotId]);

  const slot = data.slots.find((item) => item.id === slotId) ?? null;

  function clear() {
    setNotice(null);
    setPaper(null);
    setSealed(null);
    run.reset();
  }

  async function tryOpen() {
    if (!slot) return;
    setBusy("open");
    clear();
    try {
      const exam = await getExam(slot.id);
      if (exam.access === "ciphertext") {
        setSealed(exam);
        setNotice({ tone: "refused", text: "You can see the ciphertext, not the exam. No policy names you, so no node will release a key share." });
        sendAudit("exam.decrypt.denied", slot.id, { by: user?.username, audience: "admin", reason: "no policy, ciphertext only" });
        return;
      }
      const policy = await getMyPolicy(slot.id);
      setRingMode("open");
      run.start();
      const text = await doDecrypt(exam, slot.id, policy, run.listener);
      await run.settle();
      setPaper(readPaper(text));
      setNotice({ tone: "ok", text: "Opened under a quorum-approved admin policy." });
      sendAudit("exam.decrypt.ok", slot.id, { by: user?.username, audience: "admin" });
    } catch (error) {
      await run.settle();
      const text = error instanceof ApiError ? `Backend refused (${error.status}): ${error.message}.` : errorText(error);
      setNotice({ tone: error instanceof ApiError || error instanceof VaultError ? "refused" : "danger", text });
      sendAudit("exam.decrypt.denied", slot.id, { by: user?.username, audience: "admin", reason: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function requestAccess() {
    if (!slot || !user) return;
    setBusy("request");
    clear();
    try {
      const hasPolicyRequest = data.requests.some((request) => {
        const payload = request.payload as Record<string, unknown>;
        return request.status !== "REJECTED" && request.type === "policy.sign" && payload.label === "admin" && payload.assignmentId === slot.id && payload.subjectId === user.tideuserkey;
      });
      const hasRoleRequest = data.requests.some((request) => {
        const payload = request.payload as Record<string, unknown>;
        return request.status === "PENDING" && request.type === "user.addRole" && payload.username === user.username && payload.role === "_tide_decryptor";
      });
      let count = 0;
      if (!hasPolicyRequest) {
        await proposePolicy({ subjectType: "User", subjectId: user.tideuserkey, assignmentId: slot.id, access: "read", notBefore: 0, expiry: Math.floor(Date.now() / 1000) + 24 * 3600, label: "admin" });
        count += 1;
      }
      if (!hasRole("_tide_decryptor") && !hasRoleRequest) {
        await proposeChange("user.addRole", { username: user.username, role: "_tide_decryptor" });
        count += 1;
      }
      setNotice(count ? { tone: "ok", text: `${count} request${count > 1 ? "s" : ""} sent to Approvals. Sign in again after they commit.` } : { tone: "warn", text: "Access is already requested." });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function forgedTest() {
    if (!slot || !user) return;
    setBusy("forged");
    clear();
    try {
      const signature = new Uint8Array(64);
      crypto.getRandomValues(signature);
      const fake: SignedPolicy = {
        policy: {
          id: `pol_forged_${Date.now().toString(36)}`,
          contractId: "RelationshipAttestation:1",
          modelIds: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
          keyId: "exam-vault",
          params: { subjectType: "User", subjectId: user.tideuserkey, assignmentId: slot.id, roles: JSON.stringify(["_tide_decryptor"]) },
          notBefore: 0,
          expiry: Math.floor(Date.now() / 1000) + 3600,
          approvedBy: [user.username, "admin.binh", "admin.chi"],
        },
        signature: toBase64(signature),
      };
      setRingMode("forged");
      run.start();
      const decoy = await makeDecoyShares(slot.id);
      const { shares, reasons } = await releaseShares(decoy, slot.id, fake, run.listener);
      await run.settle();
      const refused = reasons.filter((item) => item.kind !== "offline");
      setNotice(shares.length === 0 ? { tone: "refused", text: `${refused.length}/5 nodes refused: ${refused[0]?.reason ?? "offline"}` } : { tone: "danger", text: `${shares.length} nodes released a share.` });
      sendAudit("exam.decrypt.denied", slot.id, { by: user.username, audience: "forged", reason: refused[0]?.reason ?? "offline" });
    } catch (error) {
      setNotice({ tone: "danger", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card title="Admin access">
      <div className={styles.accessRow}>
        <Select label="Exam slot" value={slotId} onChange={(event) => { setSlotId(event.target.value); clear(); }}>
          {data.slots.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {data.classes.find((room) => room.id === item.classId)?.name ?? item.classId}
            </option>
          ))}
        </Select>
        <div className="row">
          <Button icon={<Icon name="unlock" />} onClick={tryOpen} busy={busy === "open"} disabled={!slot || busy !== null}>
            Try to open
          </Button>
          <Button variant="secondary" onClick={requestAccess} busy={busy === "request"} disabled={!slot || busy !== null}>
            Request access
          </Button>
          <Button variant="secondary" icon={<Icon name="warn" />} onClick={forgedTest} busy={busy === "forged"} disabled={!slot || busy !== null}>
            Forged policy test
          </Button>
        </div>
      </div>
      {notice ? <Alert tone={notice.tone} title={notice.text} /> : null}
      {run.active && !paper ? (
        <NodeRing nodes={run.nodes} threshold={3} okLabel="Released" showList={false} centerTitle={ringMode === "forged" ? `${run.refusedCount}/5 refused` : `${run.okCount}/5 nodes released a share`} />
      ) : null}
      {sealed ? <CipherView exam={sealed} /> : null}
      {paper ? <ExamSheet paper={paper} /> : null}
    </Card>
  );
}
