export type Policy = {
  id: string;
  contractId: string;
  modelIds: string[];
  keyId: string;
  params: { subjectType: "User" | "Group" | "Role"; subjectId: string; assignmentId: string; roles: string };
  notBefore: number;
  expiry: number;
  approvedBy: string[];
};

export type SignedPolicy = { policy: Policy; signature: string };

export type WrappedShare = { ephemeralPublicKey: string; iv: string; data: string };

export type BundleCore = {
  v: 1;
  tag: string;
  iv: string;
  ciphertext: string;
  shares: { node: number; wrappedShare: WrappedShare }[];
};

export type Attestation = { node: number; attestation: string };

export type SealedExam = { bundle: BundleCore; digest: string; attestations: Attestation[]; uploadedBy?: string; uploadedAt?: string };

export type NetworkNode = { id: number; publicKey: string; online: boolean };

export type NetworkInfo = { networkKey: string; threshold: number; nodes: NetworkNode[] };

export type TideUser = {
  sub: string;
  username: string;
  name: string;
  roles: string[];
  groups: string[];
  tideuserkey: string;
  exp: number;
};

export type DemoUser = { username: string; name: string; roles: string[]; groups: string[] };

export type DirectoryUser = DemoUser & { id?: string; tideuserkey: string };

export type ChangeRequestType = "user.addRole" | "user.removeRole" | "user.addGroup" | "user.removeGroup" | "policy.sign";

export type PolicyRequest = {
  subjectType: "User" | "Group" | "Role";
  subjectId: string;
  assignmentId: string;
  access: "read" | "write" | "read-write";
  notBefore: number;
  expiry: number;
  label: "teacher" | "class" | "admin";
};

export type ChangeRequest = {
  id: string;
  type: ChangeRequestType;
  payload: Record<string, unknown>;
  status: "PENDING" | "COMMITTED" | "REJECTED";
  approvals: { username: string; at: string }[];
  createdBy: string;
  createdAt: string;
  committedAt?: string;
  result?: unknown;
};

export type NodeStep = "idle" | "pending" | "ok" | "refused" | "offline";

export type VaultStep = "encrypt" | "split" | "wrap" | "attest" | "release" | "combine" | "decrypt" | "verify";

export type VaultEvent =
  | { kind: "step"; step: VaultStep; state: "active" | "done" | "failed"; detail?: string }
  | { kind: "node"; node: number; state: NodeStep; detail?: string };
