import { Router } from "express";
import { db, getClass, getExam, getSlot } from "../db";
import { currentUser, hasRole } from "../auth";
import { addAudit } from "../audit";
import { canonicalJson, sha256Base64 } from "../canonical";
import { checkAttestation } from "../tide";
import { findAdminPolicy } from "./policies";

export const examRoutes = Router();

type Attestation = { node: number; attestation: string };

examRoutes.put("/:slotId", async (req, res) => {
  const user = currentUser(res);
  const slotId = req.params.slotId;
  const refuse = (status: number, body: Record<string, unknown>) => {
    addAudit(user.username, "exam.upload.denied", slotId, { reason: body.error });
    res.status(status).json(body);
  };
  const slot = getSlot(slotId);
  if (!slot) {
    refuse(404, { error: "Slot not found" });
    return;
  }
  if (!hasRole(user, "teacher") || slot.teacher !== user.username) {
    refuse(403, { error: "Only the teacher of this slot can upload" });
    return;
  }
  const now = new Date();
  if (now.getTime() >= Date.parse(slot.startsAt)) {
    refuse(423, { error: "Exam is locked after start", startsAt: slot.startsAt, now: now.toISOString() });
    return;
  }
  const { bundle, digest, attestations } = req.body ?? {};
  if (!bundle || typeof bundle !== "object" || Array.isArray(bundle) || typeof digest !== "string" || !Array.isArray(attestations)) {
    refuse(400, { error: "Body must be {bundle, digest, attestations: [{node, attestation}]}" });
    return;
  }
  if (bundle.tag !== slotId) {
    refuse(400, { error: "Bundle tag does not match slotId" });
    return;
  }
  const recomputed = sha256Base64(canonicalJson(bundle));
  if (recomputed !== digest) {
    refuse(400, { error: "Digest does not match bundle" });
    return;
  }
  const validNodes = new Set<number>();
  const kept: Attestation[] = [];
  for (const item of attestations as Attestation[]) {
    if (!item || typeof item.node !== "number" || typeof item.attestation !== "string") continue;
    if (validNodes.has(item.node)) continue;
    if (await checkAttestation(item.node, slotId, digest, user.username, item.attestation)) {
      validNodes.add(item.node);
      kept.push({ node: item.node, attestation: item.attestation });
    }
  }
  if (validNodes.size < 3) {
    refuse(403, { error: "Need at least 3 valid attestations from distinct nodes", valid: validNodes.size });
    return;
  }
  const uploadedAt = now.toISOString();
  db.prepare(
    "INSERT OR REPLACE INTO exams (slotId, bundle, digest, attestations, uploadedBy, uploadedAt) VALUES (?, ?, ?, ?, ?, ?)",
  ).run(slotId, canonicalJson(bundle), digest, JSON.stringify(kept), user.username, uploadedAt);
  addAudit(user.username, "exam.upload", slotId, { digest, nodes: [...validNodes].sort((a, b) => a - b) });
  res.json({ slotId, digest, attestations: kept, uploadedBy: user.username, uploadedAt });
});

examRoutes.get("/:slotId", (req, res) => {
  const user = currentUser(res);
  const slotId = req.params.slotId;
  const now = new Date();
  const nowText = now.toISOString();
  const slot = getSlot(slotId);
  if (!slot) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }
  const deny = (action: string, status: number, body: Record<string, unknown>) => {
    addAudit(user.username, action, slotId, { result: "denied", reason: body.error });
    res.status(status).json(body);
  };
  let action = "exam.fetch";
  let role = "";
  let access = "policy";
  const groupPath = getClass(slot.classId)?.groupPath;
  if (hasRole(user, "teacher") && slot.teacher === user.username) {
    role = "teacher";
  } else if (groupPath && user.groups.includes(groupPath)) {
    role = "student";
    if (now.getTime() < Date.parse(slot.startsAt)) {
      deny(action, 425, { error: "Exam not open yet", opensAt: slot.startsAt, now: nowText });
      return;
    }
    if (now.getTime() >= Date.parse(slot.endsAt)) {
      deny(action, 410, { error: "Exam closed", closedAt: slot.endsAt, now: nowText });
      return;
    }
  } else if (hasRole(user, "admin")) {
    action = "exam.fetch.admin";
    role = "admin";
    if (!findAdminPolicy(slotId, user)) access = "ciphertext";
  } else {
    deny(action, 403, { error: "You are not allowed to fetch this exam" });
    return;
  }
  const exam = getExam(slotId);
  if (!exam) {
    deny(action, 404, { error: "No exam uploaded for this slot" });
    return;
  }
  addAudit(user.username, action, slotId, { result: access === "ciphertext" ? "ciphertext-only" : "allowed", role });
  res.json({
    access,
    bundle: JSON.parse(exam.bundle),
    digest: exam.digest,
    attestations: JSON.parse(exam.attestations),
    uploadedBy: exam.uploadedBy,
    uploadedAt: exam.uploadedAt,
  });
});
