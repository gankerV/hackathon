import { API_URL } from "./tide/config";
import { readToken } from "./tide/session";
import type { Attestation, BundleCore, SealedExam, SignedPolicy } from "./tide/types";

export type ClassRoom = { id: string; name: string; groupPath: string };

export type Slot = {
  id: string;
  classId: string;
  title: string;
  kind: "midterm" | "final";
  startsAt: string;
  endsAt: string;
  teacher: string;
  status: "upcoming" | "open" | "closed";
  hasExam: boolean;
  policies: { teacher: boolean; class: boolean };
};

export type AuditEntry = { id: string | number; at: string; actor: string; action: string; target: string; detail: unknown; prevHash: string; hash: string };

export type StoredExam = SealedExam & { uploadedBy: string; uploadedAt: string; access: "policy" | "ciphertext" };

export class ApiError extends Error {
  status: number;
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

async function call<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = readToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      cache: "no-store",
    });
  } catch {
    throw new ApiError(`Cannot reach the backend at ${API_URL}.`, 0, {});
  }
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { error: text };
  }
  if (!response.ok) {
    const body = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    throw new ApiError(String(body.error ?? body.message ?? `Request failed (${response.status}).`), response.status, body);
  }
  return data as T;
}

function parseMaybe<T>(value: unknown): T {
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as T;
    } catch {
      return value as T;
    }
  }
  return value as T;
}

function listOf<T>(data: unknown, keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    for (const key of keys) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

export function getServerTime() {
  return call<{ now: string }>("/api/time");
}

export function getMe() {
  return call<Record<string, unknown>>("/api/me");
}

export async function getClasses() {
  return listOf<ClassRoom>(await call<unknown>("/api/classes"), ["classes", "items"]);
}

export function createClass(name: string, groupPath: string) {
  return call<ClassRoom>("/api/classes", { body: { name, groupPath } });
}

export async function getSlots() {
  const slots = listOf<Slot>(await call<unknown>("/api/slots"), ["slots", "items"]);
  return slots.map((slot) => ({ ...slot, policies: slot.policies ?? { teacher: false, class: false } }));
}

export function createSlot(input: { classId: string; title: string; kind: "midterm" | "final"; startsAt: string; endsAt: string; teacher: string }) {
  return call<Slot>("/api/slots", { body: input });
}

export function savePolicy(slotId: string, audience: "teacher" | "class" | "admin", signedPolicy: SignedPolicy) {
  return call<unknown>("/api/policies", { body: { slotId, audience, signedPolicy } });
}

export function readSignedPolicy(data: unknown): SignedPolicy {
  const value = parseMaybe<Record<string, unknown>>(data);
  if (value && typeof value === "object") {
    if ("policy" in value && "signature" in value) return { policy: parseMaybe(value.policy), signature: String(value.signature) };
    if ("signedPolicy" in value) return readSignedPolicy(value.signedPolicy);
    if ("signed" in value) return readSignedPolicy(value.signed);
  }
  throw new ApiError("The stored policy has an unknown shape.", 500, {});
}

export async function getMyPolicy(slotId: string) {
  return readSignedPolicy(await call<unknown>(`/api/policies/mine?slotId=${encodeURIComponent(slotId)}`));
}

export function uploadExam(slotId: string, sealed: { bundle: BundleCore; digest: string; attestations: Attestation[] }) {
  return call<unknown>(`/api/exams/${encodeURIComponent(slotId)}`, { method: "PUT", body: sealed });
}

export async function getExam(slotId: string): Promise<StoredExam> {
  const data = await call<Record<string, unknown>>(`/api/exams/${encodeURIComponent(slotId)}`);
  return {
    bundle: parseMaybe<BundleCore>(data.bundle),
    digest: String(data.digest),
    attestations: parseMaybe<Attestation[]>(data.attestations) ?? [],
    uploadedBy: String(data.uploadedBy ?? ""),
    uploadedAt: String(data.uploadedAt ?? ""),
    access: data.access === "ciphertext" ? "ciphertext" : "policy",
  };
}

export function sendAudit(action: string, target: string, detail: unknown) {
  return call<unknown>("/api/audit", { body: { action, target, detail } }).catch(() => null);
}

export async function getAudit() {
  const data = await call<unknown>("/api/audit");
  const entries = listOf<AuditEntry>(data, ["entries", "items", "audit", "log"]);
  const chainValid = data && typeof data === "object" && !Array.isArray(data) ? Boolean((data as Record<string, unknown>).chainValid) : false;
  return { entries, chainValid };
}
