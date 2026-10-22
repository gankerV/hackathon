import { Router } from "express";
import { db, findPolicies, getClass, getSlot, type PolicyRow, type SlotRow } from "../db";
import { currentUser, hasRole, requireRole, type User } from "../auth";
import { addAudit } from "../audit";
import { checkPolicySignature, readPolicyRoles, type SignedPolicy } from "../tide";

export const policyRoutes = Router();

const audiences = ["teacher", "class", "admin"] as const;
type Audience = (typeof audiences)[number];

function looksSigned(value: unknown): value is SignedPolicy {
  const signed = value as SignedPolicy;
  return (
    !!signed &&
    typeof signed.signature === "string" &&
    !!signed.policy &&
    typeof signed.policy.id === "string" &&
    !!signed.policy.params &&
    typeof signed.policy.params.subjectType === "string" &&
    typeof signed.policy.params.subjectId === "string" &&
    typeof signed.policy.params.assignmentId === "string" &&
    typeof signed.policy.params.roles === "string" &&
    typeof signed.policy.notBefore === "number" &&
    typeof signed.policy.expiry === "number"
  );
}

function checkAudience(signed: SignedPolicy, audience: Audience, slot: SlotRow): string | null {
  const { params } = signed.policy;
  const roles = readPolicyRoles(signed.policy);
  if (!roles) return "params.roles must be a JSON array written as a string";
  const readOnly = !roles.includes("_tide_encryptor");
  if (audience === "class") {
    const groupPath = getClass(slot.classId)?.groupPath;
    if (params.subjectType !== "Group") return "Class policy must have subjectType Group";
    if (params.subjectId !== groupPath) return `Class policy subject must be ${groupPath}`;
    if (!readOnly) return "Class policy must be read-only";
    return null;
  }
  if (params.subjectType !== "User") return `${audience} policy must have subjectType User`;
  if (audience === "admin" && !readOnly) return "Admin policy must be read-only";
  return null;
}

policyRoutes.post("/", requireRole("admin"), async (req, res) => {
  const user = currentUser(res);
  const { slotId, audience, signedPolicy } = req.body ?? {};
  const refuse = (status: number, error: string) => {
    addAudit(user.username, "policy.store.denied", String(slotId ?? ""), { audience, reason: error });
    res.status(status).json({ error });
  };
  if (typeof slotId !== "string" || !audiences.includes(audience) || !looksSigned(signedPolicy)) {
    refuse(400, "Body must be {slotId, audience: teacher|class|admin, signedPolicy: {policy, signature}}");
    return;
  }
  const slot = getSlot(slotId);
  if (!slot) {
    refuse(404, "Slot not found");
    return;
  }
  const { policy } = signedPolicy;
  if (policy.contractId !== "RelationshipAttestation:1") {
    refuse(400, "Unsupported contractId");
    return;
  }
  if (!(policy.expiry > 0)) {
    refuse(400, "Policy expiry must be > 0");
    return;
  }
  if (!(await checkPolicySignature(signedPolicy))) {
    refuse(400, "Policy signature is not valid under the network key");
    return;
  }
  if (policy.params.assignmentId !== slotId) {
    refuse(400, "Policy assignmentId does not match slotId");
    return;
  }
  const audienceError = checkAudience(signedPolicy, audience, slot);
  if (audienceError) {
    refuse(400, audienceError);
    return;
  }
  const existing = db.prepare("SELECT id FROM policies WHERE id = ?").get(policy.id);
  if (existing) {
    res.status(200).json({ id: policy.id, slotId, audience, stored: false });
    return;
  }
  const createdAt = new Date().toISOString();
  db.prepare(
    "INSERT INTO policies (id, slotId, audience, subjectType, subjectId, signed, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(
    policy.id,
    slotId,
    audience,
    policy.params.subjectType,
    policy.params.subjectId,
    JSON.stringify(signedPolicy),
    createdAt,
  );
  addAudit(user.username, "policy.store", slotId, {
    policyId: policy.id,
    audience,
    subjectType: policy.params.subjectType,
    subjectId: policy.params.subjectId,
    roles: policy.params.roles,
    approvedBy: policy.approvedBy,
  });
  res.status(201).json({ id: policy.id, slotId, audience, stored: true });
});

function pickPolicy(rows: PolicyRow[], subjectId?: string): PolicyRow | undefined {
  return rows.find((row) => row.subjectId === subjectId) ?? (subjectId === undefined ? rows[0] : undefined);
}

export function findAdminPolicy(slotId: string, user: User): PolicyRow | undefined {
  if (!user.userKey) return undefined;
  return pickPolicy(findPolicies(slotId, "admin"), user.userKey);
}

export function findUsablePolicy(slot: SlotRow, user: User): PolicyRow | undefined {
  if (hasRole(user, "teacher") && slot.teacher === user.username) {
    const rows = findPolicies(slot.id, "teacher");
    const found = pickPolicy(rows, user.userKey) ?? rows[0];
    if (found) return found;
  }
  const groupPath = getClass(slot.classId)?.groupPath;
  if (groupPath && user.groups.includes(groupPath)) {
    const found = pickPolicy(findPolicies(slot.id, "class"), groupPath);
    if (found) return found;
  }
  if (hasRole(user, "admin")) return findAdminPolicy(slot.id, user);
  return undefined;
}

policyRoutes.get("/mine", (req, res) => {
  const user = currentUser(res);
  const slotId = req.query.slotId;
  if (typeof slotId !== "string" || !slotId) {
    res.status(400).json({ error: "slotId query parameter is required" });
    return;
  }
  const slot = getSlot(slotId);
  if (!slot) {
    res.status(404).json({ error: "Slot not found" });
    return;
  }
  const row = findUsablePolicy(slot, user);
  if (!row) {
    res.status(404).json({ error: "No policy for you on this slot" });
    return;
  }
  res.json(JSON.parse(row.signed));
});
