import type { JWK } from "jose";

export type User = {
  id: string;
  username: string;
  name: string;
  roles: string[];
  groups: string[];
  tideuserkey: string;
};

export type NodeRecord = {
  id: number;
  privateKey: string;
  publicKey: string;
  online: boolean;
};

export type StoredKeys = {
  tokenPrivate: JWK;
  tokenPublic: JWK;
  networkPrivate: string;
  networkPublic: string;
};

export type Approval = { username: string; at: string };

export type RequestStatus = "PENDING" | "COMMITTED" | "REJECTED";

export type ChangeRequest = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  status: RequestStatus;
  approvals: Approval[];
  createdBy: string;
  createdAt: string;
  committedAt?: string;
  result?: unknown;
};

export type State = {
  users: User[];
  keys: StoredKeys;
  nodes: NodeRecord[];
  changeRequests: ChangeRequest[];
};

export type Policy = {
  id: string;
  contractId: string;
  modelIds: string[];
  keyId: string;
  params: {
    subjectType: string;
    subjectId: string;
    assignmentId: string;
    roles: string;
  };
  notBefore: number;
  expiry: number;
  approvedBy: string[];
};

export type SignedPolicy = { policy: Policy; signature: string };

export type Claims = {
  sub: string;
  preferred_username: string;
  name: string;
  realm_access: { roles: string[] };
  groups: string[];
  tideuserkey: string;
};

export type WrappedShare = { ephemeralPublicKey: string; iv: string; data: string };

export class Refusal extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
