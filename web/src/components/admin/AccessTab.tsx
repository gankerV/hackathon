"use client";

import { useEffect, useState } from "react";
import { ExamSheet } from "@/components/app/ExamSheet";
import { ThresholdPanel } from "@/components/app/ThresholdPanel";
import { decryptPlan, useVaultRun } from "@/components/app/useVaultRun";
import { Alert, Badge, Button, Card, Icon, NodeRing, Select } from "@/components/ui";
import { ApiError, getExam, getMyPolicy, sendAudit } from "@/lib/api";
import { errorText } from "@/lib/format";
import { readPaper } from "@/lib/paper";
import type { ExamPaper } from "@/lib/paper";
import { toBase64 } from "@/lib/tide/bytes";
import { ADMIN_THRESHOLD, VaultError, makeDecoyShares, releaseShares, signIn, useTide } from "@/lib/tide";
import type { SignedPolicy } from "@/lib/tide";
import { proposeChange, proposePolicy } from "./policy";
import styles from "./Admin.module.css";
import type { AdminData } from "./useAdminData";

const forgedPlan = [{ id: "release", label: "Present forged policy to 5 nodes" }];

type Notice = { tone: "ok" | "danger" | "warn" | "info" | "refused"; title: string; text?: string };

export function AccessTab({ data, onProposed }: { data: AdminData; onProposed: () => void }) {
  const { user, hasRole, doDecrypt } = useTide();
  const [slotId, setSlotId] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [backendNotice, setBackendNotice] = useState<Notice | null>(null);
  const [networkNotice, setNetworkNotice] = useState<Notice | null>(null);
  const [forgedNotice, setForgedNotice] = useState<Notice | null>(null);
  const [paper, setPaper] = useState<ExamPaper | null>(null);
  const run = useVaultRun(decryptPlan);
  const forged = useVaultRun(forgedPlan);

  useEffect(() => {
    if (!slotId && data.slots.length) setSlotId((data.slots.find((item) => item.hasExam) ?? data.slots[0]).id);
  }, [data.slots, slotId]);

  const slot = data.slots.find((item) => item.id === slotId) ?? null;
  const policyRequests = data.requests.filter((request) => {
    const payload = request.payload as Record<string, unknown>;
    return request.type === "policy.sign" && payload.label === "admin" && payload.assignmentId === slotId && payload.subjectId === user?.tideuserkey;
  });
  const policyDone = policyRequests.find((request) => request.status === "COMMITTED");
  const policyPending = policyRequests.find((request) => request.status === "PENDING");
  const roleRequest = data.requests.find((request) => request.type === "user.addRole" && request.status === "PENDING" && (request.payload as Record<string, unknown>).username === user?.username && (request.payload as Record<string, unknown>).role === "_tide_decryptor");
  const holdsRole = hasRole("_tide_decryptor");

  function clearRuns() {
    setPaper(null);
    setBackendNotice(null);
    setNetworkNotice(null);
    run.reset();
  }

  async function requestPolicy() {
    if (!slot || !user) return;
    setBusy("policy");
    try {
      const request = await proposePolicy({ subjectType: "User", subjectId: user.tideuserkey, assignmentId: slot.id, access: "read", notBefore: 0, expiry: Math.floor(Date.now() / 1000) + 24 * 3600, label: "admin" });
      setNotice({ tone: "ok", title: `Access request ${request.id} proposed`, text: `Read-only, for you only, for 24 hours. It needs ${ADMIN_THRESHOLD} admin approvals.` });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", title: "Could not propose access", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function requestRole() {
    if (!user) return;
    setBusy("role");
    try {
      const request = await proposeChange("user.addRole", { username: user.username, role: "_tide_decryptor" });
      setNotice({ tone: "ok", title: `Role request ${request.id} proposed`, text: "The network only releases shares to holders of _tide_decryptor." });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", title: "Could not propose the role", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function refreshToken() {
    if (!user) return;
    setBusy("token");
    try {
      await signIn(user.username);
    } finally {
      setBusy(null);
    }
  }

  async function tryOpen() {
    if (!slot) return;
    setBusy("open");
    clearRuns();
    try {
      run.mark("fetch", "active");
      const exam = await getExam(slot.id);
      run.mark("fetch", "done", "Backend released the ciphertext: an admin policy names you");
      setBackendNotice({ tone: "ok", title: "Backend gate passed", text: "A quorum-signed admin policy for you is on file. Now the network decides." });
      const policy = await getMyPolicy(slot.id);
      const text = await doDecrypt(exam, slot.id, policy, run.listener);
      await run.settle();
      setPaper(readPaper(text));
      sendAudit("exam.decrypt.ok", slot.id, { by: user?.username, audience: "admin" });
    } catch (error) {
      await run.settle();
      if (error instanceof ApiError) {
        run.mark("fetch", "failed", `${error.status} ${error.message}`);
        setBackendNotice({ tone: "refused", title: `Backend refused (${error.status})`, text: `${error.message}. Being an admin is not enough: the server needs a policy signed by ${ADMIN_THRESHOLD} admins that names you.` });
      } else if (error instanceof VaultError) {
        setNetworkNotice({ tone: "refused", title: "Access refused by the network", text: error.message });
      } else {
        setNetworkNotice({ tone: "danger", title: "Could not open the paper", text: errorText(error) });
      }
      sendAudit("exam.decrypt.denied", slot.id, { by: user?.username, audience: "admin", reason: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  async function tryForged() {
    if (!slot || !user) return;
    setBusy("forged");
    setForgedNotice(null);
    forged.reset();
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
      forged.listener({ kind: "step", step: "release", state: "active" });
      const decoy = await makeDecoyShares(slot.id);
      const { shares, reasons } = await releaseShares(decoy, slot.id, fake, forged.listener);
      forged.listener({ kind: "step", step: "release", state: shares.length >= 3 ? "done" : "failed", detail: `${shares.length} of 5 nodes released a share` });
      await forged.settle();
      const refused = reasons.filter((item) => item.kind !== "offline");
      setForgedNotice(
        shares.length === 0
          ? { tone: "refused", title: `${refused.length} of 5 nodes refused. No share left the network.`, text: refused[0] ? `First reason: "${refused[0].reason}" A copied database plus a hand-written policy gets an attacker nothing.` : "All nodes were offline." }
          : { tone: "danger", title: `${shares.length} nodes released a share`, text: "This should never happen with a forged signature." },
      );
      sendAudit("exam.decrypt.denied", slot.id, { by: user.username, audience: "forged", reason: refused[0]?.reason ?? "offline" });
    } catch (error) {
      setForgedNotice({ tone: "danger", title: "Could not run the test", text: errorText(error) });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="stack">
      <div className={styles.lead}>
        <p className="muted">Admins run the school system, yet they cannot read exam papers. To open one, an admin needs a read-only policy naming them, signed by {ADMIN_THRESHOLD} admins, and the <code>_tide_decryptor</code> role, also granted by quorum. Try it.</p>
      </div>
      <div className={styles.accessTop}>
        <Select label="Exam slot" value={slotId} onChange={(event) => { setSlotId(event.target.value); clearRuns(); forged.reset(); setForgedNotice(null); }}>
          {data.slots.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title} · {data.classes.find((room) => room.id === item.classId)?.name ?? item.classId} {item.hasExam ? "· sealed" : "· no paper"}
            </option>
          ))}
        </Select>
      </div>
      {notice ? <Alert tone={notice.tone} title={notice.title} action={notice.tone === "ok" ? <Button size="sm" variant="secondary" onClick={onProposed}>Go to approvals</Button> : undefined}>{notice.text}</Alert> : null}
      {slot ? (
        <>
          <Card title="What it takes for you to read this paper" eyebrow={`${user?.name} · admin`}>
            <ol className={styles.checklist}>
              <li className={policyDone ? styles.checkDone : ""}>
                <span className={styles.checkMark}>{policyDone ? <Icon name="check" /> : "1"}</span>
                <span className={styles.checkText}>
                  <strong>A read-only policy naming you, signed by {ADMIN_THRESHOLD} admins</strong>
                  <span className="muted">{policyDone ? "Signed by the quorum. Make sure it is stored (Approvals)." : policyPending ? `Waiting for approvals: ${policyPending.approvals.length}/${ADMIN_THRESHOLD}` : "Not requested."}</span>
                </span>
                {policyDone ? <Badge tone="ok">signed</Badge> : policyPending ? <Badge tone="warn">{policyPending.approvals.length}/{ADMIN_THRESHOLD}</Badge> : <Button size="sm" variant="secondary" onClick={requestPolicy} busy={busy === "policy"}>Request read access</Button>}
              </li>
              <li className={holdsRole ? styles.checkDone : ""}>
                <span className={styles.checkMark}>{holdsRole ? <Icon name="check" /> : "2"}</span>
                <span className={styles.checkText}>
                  <strong>The <code>_tide_decryptor</code> role in your Tide token</strong>
                  <span className="muted">{holdsRole ? "Present in your current token." : roleRequest ? `Waiting for approvals: ${roleRequest.approvals.length}/${ADMIN_THRESHOLD}. Refresh your token after it commits.` : "Admins do not hold it by default."}</span>
                </span>
                {holdsRole ? <Badge tone="ok">in token</Badge> : (
                  <span className="row">
                    {roleRequest ? <Badge tone="warn">{roleRequest.approvals.length}/{ADMIN_THRESHOLD}</Badge> : <Button size="sm" variant="secondary" onClick={requestRole} busy={busy === "role"}>Request role</Button>}
                    <Button size="sm" variant="ghost" onClick={refreshToken} busy={busy === "token"}>Refresh token</Button>
                  </span>
                )}
              </li>
            </ol>
            <div className="row">
              <Button size="lg" icon={<Icon name="unlock" />} onClick={tryOpen} busy={busy === "open"} disabled={busy !== null || !slot.hasExam}>
                Try to open this exam
              </Button>
              {!slot.hasExam ? <span className="muted">No sealed paper in this slot yet.</span> : null}
            </div>
            {backendNotice ? <Alert tone={backendNotice.tone} title={backendNotice.title}>{backendNotice.text}</Alert> : null}
            {networkNotice ? <Alert tone={networkNotice.tone} title={networkNotice.title}>{networkNotice.text}</Alert> : null}
          </Card>
          {run.steps.some((step) => step.state !== "todo" && step.id !== "fetch") ? (
            <ThresholdPanel title="The network decides" eyebrow="Admin read-only policy" nodes={run.nodes} steps={run.steps} okLabel="Released" centerTitle="Key shares" centerNote="Each node checks the policy signature, the time window and your token on its own." />
          ) : null}
          {paper ? <ExamSheet paper={paper} slotTitle={slot.title} note="Opened under a quorum-approved admin policy. This access is in the audit log." /> : null}

          <Card tone="sunken" title="Even with the ciphertext, the network refuses" eyebrow="Insider test">
            <p className="muted">Suppose a database admin copies the sealed paper and writes their own policy granting themselves access. This sends that forged policy, with share envelopes standing in for the copied ciphertext, straight to all five ORK nodes.</p>
            <div className="row">
              <Button variant="secondary" icon={<Icon name="warn" />} onClick={tryForged} busy={busy === "forged"} disabled={busy !== null}>
                Present a forged policy to the network
              </Button>
            </div>
            {forged.steps.some((step) => step.state !== "todo") ? <NodeRing nodes={forged.nodes} threshold={3} okLabel="Released" centerTitle="Forged policy" centerNote="Signature does not verify under the network key." /> : null}
            {forgedNotice ? <Alert tone={forgedNotice.tone} title={forgedNotice.title}>{forgedNotice.text}</Alert> : null}
          </Card>
        </>
      ) : (
        <p className={styles.empty}>Create an exam slot first.</p>
      )}
    </div>
  );
}
