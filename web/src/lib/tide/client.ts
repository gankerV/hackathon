import { TIDE_URL } from "./config";
import { readToken, saveToken } from "./session";
import type { ChangeRequest, ChangeRequestType, DemoUser, DirectoryUser, NetworkInfo } from "./types";

export type FailureKind = "refused" | "offline" | "auth" | "unreachable" | "conflict" | "error";

export class TideError extends Error {
  status: number;
  kind: FailureKind;
  constructor(message: string, status: number, kind: FailureKind) {
    super(message);
    this.status = status;
    this.kind = kind;
  }
}

function kindOf(status: number): FailureKind {
  if (status === 403) return "refused";
  if (status === 503) return "offline";
  if (status === 401) return "auth";
  if (status === 409) return "conflict";
  return "error";
}

export async function callTide<T>(path: string, options: { method?: string; body?: unknown; auth?: boolean; signal?: AbortSignal } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.auth !== false) {
    const token = readToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  let response: Response;
  try {
    response = await fetch(`${TIDE_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch {
    throw new TideError(`Cannot reach the Tide network at ${TIDE_URL}.`, 0, "unreachable");
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data && typeof data === "object" && "error" in data ? String((data as { error: unknown }).error) : `Request failed (${response.status}).`;
    throw new TideError(message, response.status, kindOf(response.status));
  }
  return data as T;
}

export function getNetwork() {
  return callTide<NetworkInfo>("/network", { auth: false });
}

export function getDemoUsers() {
  return callTide<DemoUser[] | { users: DemoUser[] }>("/demo-users", { auth: false }).then((data) => (Array.isArray(data) ? data : data.users ?? []));
}

export async function signIn(username: string) {
  const data = await callTide<{ token: string; user: DemoUser }>("/login", { body: { username }, auth: false });
  saveToken(data.token);
  return data;
}

export function signOut() {
  saveToken(null);
}

export function getUsers() {
  return callTide<DirectoryUser[] | { users: DirectoryUser[] }>("/users").then((data) => (Array.isArray(data) ? data : data.users ?? []));
}

export function getChangeRequests() {
  return callTide<ChangeRequest[] | { changeRequests: ChangeRequest[] }>("/change-requests").then((data) => (Array.isArray(data) ? data : data.changeRequests ?? []));
}

export function createChangeRequest(type: ChangeRequestType, payload: Record<string, unknown>) {
  return callTide<ChangeRequest>("/change-requests", { body: { type, payload } });
}

export function approveChangeRequest(id: string) {
  return callTide<ChangeRequest>(`/change-requests/${encodeURIComponent(id)}/approve`, { body: {} });
}

export function rejectChangeRequest(id: string) {
  return callTide<ChangeRequest>(`/change-requests/${encodeURIComponent(id)}/reject`, { body: {} });
}

export function toggleNode(node: number) {
  return callTide<unknown>(`/ork/${node}/toggle`, { body: {}, auth: false });
}
