import { canonicalJson } from "./canonical.ts";
import { randomHex } from "./bytes.ts";
import { signWithNetwork, verifyWithNetwork } from "./keys.ts";
import { Refusal, type Claims, type Policy, type SignedPolicy } from "./types.ts";

export const SUBJECT_TYPES = ["User", "Group", "Role"];
export const ACCESS_TYPES = ["read", "write", "read-write"];

const accessRoles: Record<string, string[]> = {
  read: ["_tide_decryptor"],
  write: ["_tide_encryptor"],
  "read-write": ["_tide_encryptor", "_tide_decryptor"],
};

export function buildPolicy(payload: Record<string, unknown>, approvedBy: string[]): Policy {
  return {
    id: "pol_" + randomHex(8),
    contractId: "RelationshipAttestation:1",
    modelIds: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
    keyId: "exam-vault",
    params: {
      subjectType: String(payload.subjectType),
      subjectId: String(payload.subjectId),
      assignmentId: String(payload.assignmentId),
      roles: JSON.stringify(accessRoles[String(payload.access)]),
    },
    notBefore: Number(payload.notBefore ?? 0),
    expiry: Number(payload.expiry),
    approvedBy,
  };
}

export async function signPolicy(policy: Policy): Promise<SignedPolicy> {
  return { policy, signature: await signWithNetwork(canonicalJson(policy)) };
}

function readRoles(policy: Policy): string[] {
  try {
    const roles = JSON.parse(policy.params.roles);
    return Array.isArray(roles) ? roles : [];
  } catch {
    return [];
  }
}

function checkSubject(policy: Policy, caller: Claims): void {
  const { subjectType, subjectId } = policy.params;
  if (subjectType === "User" && caller.tideuserkey !== subjectId) {
    throw new Refusal(403, `'${subjectId}' user not found in doken.`);
  }
  if (subjectType === "Group" && !(caller.groups ?? []).includes(subjectId)) {
    throw new Refusal(403, `'${subjectId}' group not found in doken.`);
  }
  if (subjectType === "Role" && !(caller.realm_access?.roles ?? []).includes(subjectId)) {
    throw new Refusal(403, `'${subjectId}' role not found in doken.`);
  }
  if (!SUBJECT_TYPES.includes(subjectType)) throw new Refusal(403, "Unknown subject type.");
}

export async function checkPolicy(signed: SignedPolicy, tag: string, caller: Claims, role: string): Promise<void> {
  const policy = signed?.policy;
  if (!policy?.params || typeof signed.signature !== "string") throw new Refusal(400, "Missing signed policy.");
  if (!(await verifyWithNetwork(canonicalJson(policy), signed.signature))) {
    throw new Refusal(403, "Policy signature is invalid.");
  }
  const now = Math.floor(Date.now() / 1000);
  if (now < policy.notBefore) throw new Refusal(403, "Policy not yet valid.");
  if (now >= policy.expiry) throw new Refusal(403, "Policy expired.");
  if (policy.params.assignmentId !== tag) throw new Refusal(403, "Tags do not contain assignmentId.");
  checkSubject(policy, caller);
  if (!readRoles(policy).includes(role)) throw new Refusal(403, `${role} not found in list of roles.`);
  if (!(caller.realm_access?.roles ?? []).includes(role)) throw new Refusal(403, `${role} not found in doken roles.`);
}
