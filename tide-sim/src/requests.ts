import { randomHex } from "./bytes.ts";
import { ACCESS_TYPES, SUBJECT_TYPES, buildPolicy, signPolicy } from "./policy.ts";
import { ADMIN_THRESHOLD, findUser, getState, saveState } from "./state.ts";
import { Refusal, type ChangeRequest } from "./types.ts";

const userTypes: Record<string, "role" | "group"> = {
  "user.addRole": "role",
  "user.removeRole": "role",
  "user.addGroup": "group",
  "user.removeGroup": "group",
};

function isText(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function checkPayload(type: string, payload: Record<string, unknown>): Record<string, unknown> {
  const field = userTypes[type];
  if (field) {
    if (!isText(payload.username) || !findUser(payload.username)) throw new Refusal(400, "Unknown username.");
    if (!isText(payload[field])) throw new Refusal(400, `Missing ${field}.`);
    return { username: payload.username, [field]: payload[field] };
  }
  if (type === "policy.sign") {
    if (!SUBJECT_TYPES.includes(String(payload.subjectType))) throw new Refusal(400, "Invalid subjectType.");
    if (!isText(payload.subjectId)) throw new Refusal(400, "Missing subjectId.");
    if (!isText(payload.assignmentId)) throw new Refusal(400, "Missing assignmentId.");
    if (!ACCESS_TYPES.includes(String(payload.access))) throw new Refusal(400, "Invalid access.");
    const notBefore = Number(payload.notBefore ?? 0);
    const expiry = Number(payload.expiry);
    if (!Number.isFinite(notBefore) || notBefore < 0) throw new Refusal(400, "Invalid notBefore.");
    if (!Number.isFinite(expiry) || expiry <= 0) throw new Refusal(400, "expiry must be > 0.");
    return {
      subjectType: payload.subjectType,
      subjectId: payload.subjectId,
      assignmentId: payload.assignmentId,
      access: payload.access,
      notBefore,
      expiry,
      label: typeof payload.label === "string" ? payload.label : "",
    };
  }
  throw new Refusal(400, "Unknown change request type.");
}

export function listRequests(): ChangeRequest[] {
  return [...getState().changeRequests].reverse();
}

export function createRequest(type: string, payload: unknown, createdBy: string): ChangeRequest {
  const request: ChangeRequest = {
    id: "cr_" + randomHex(8),
    type,
    payload: checkPayload(type, (payload ?? {}) as Record<string, unknown>),
    status: "PENDING",
    approvals: [],
    createdBy,
    createdAt: new Date().toISOString(),
  };
  getState().changeRequests.push(request);
  saveState();
  return request;
}

function findPendingRequest(id: string): ChangeRequest {
  const request = getState().changeRequests.find((item) => item.id === id);
  if (!request) throw new Refusal(404, "Change request not found.");
  if (request.status !== "PENDING") throw new Refusal(409, `Change request is already ${request.status}.`);
  return request;
}

function changeUser(request: ChangeRequest) {
  const user = findUser(String(request.payload.username));
  if (!user) throw new Refusal(400, "Unknown username.");
  const list = userTypes[request.type] === "role" ? user.roles : user.groups;
  const value = String(request.payload.role ?? request.payload.group);
  const index = list.indexOf(value);
  if (request.type.includes(".add") && index < 0) list.push(value);
  if (request.type.includes(".remove") && index >= 0) list.splice(index, 1);
  return user;
}

async function applyRequest(request: ChangeRequest): Promise<unknown> {
  if (request.type === "policy.sign") {
    const approvedBy = request.approvals.map((approval) => approval.username);
    return signPolicy(buildPolicy(request.payload, approvedBy));
  }
  return structuredClone(changeUser(request));
}

export async function approveRequest(id: string, username: string): Promise<ChangeRequest> {
  const request = findPendingRequest(id);
  if (request.approvals.some((approval) => approval.username === username)) {
    throw new Refusal(409, "You have already approved this change request.");
  }
  request.approvals.push({ username, at: new Date().toISOString() });
  if (request.approvals.length >= ADMIN_THRESHOLD) {
    request.status = "COMMITTED";
    request.committedAt = new Date().toISOString();
    request.result = await applyRequest(request);
  }
  saveState();
  return request;
}

export function rejectRequest(id: string): ChangeRequest {
  const request = findPendingRequest(id);
  request.status = "REJECTED";
  saveState();
  return request;
}
