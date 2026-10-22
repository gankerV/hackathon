import { createLocalJWKSet, jwtVerify, type JWTPayload, type JSONWebKeySet } from "jose";
import type { webcrypto } from "node:crypto";
import { canonicalJson } from "./canonical";

type CryptoKey = webcrypto.CryptoKey;

export const tideUrl = (process.env.TIDE_URL ?? "http://localhost:4100").replace(/\/$/, "");

export class TideDownError extends Error {}

type KeySet = ReturnType<typeof createLocalJWKSet>;

let keySet: KeySet | null = null;
let networkKey: CryptoKey | null = null;
let networkLoadedAt = 0;

async function fetchJson(path: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${tideUrl}${path}`);
  } catch {
    throw new TideDownError(`tide-sim unreachable at ${tideUrl}`);
  }
  if (!response.ok) throw new TideDownError(`tide-sim ${path} returned ${response.status}`);
  return response.json();
}

async function loadKeySet(): Promise<KeySet> {
  const jwks = (await fetchJson("/jwks")) as JSONWebKeySet;
  keySet = createLocalJWKSet(jwks);
  return keySet;
}

async function loadNetworkKey(): Promise<CryptoKey> {
  const network = (await fetchJson("/network")) as { networkKey: string };
  const raw = Buffer.from(network.networkKey, "base64");
  networkKey = await crypto.subtle.importKey("raw", raw, { name: "Ed25519" }, false, ["verify"]);
  networkLoadedAt = Date.now();
  return networkKey;
}

function isKeyProblem(error: unknown): boolean {
  const code = (error as { code?: string })?.code;
  return code === "ERR_JWKS_NO_MATCHING_KEY" || code === "ERR_JWS_SIGNATURE_VERIFICATION_FAILED";
}

export async function checkToken(token: string): Promise<JWTPayload> {
  const firstSet = keySet ?? (await loadKeySet());
  try {
    return (await jwtVerify(token, firstSet, { algorithms: ["ES256"] })).payload;
  } catch (error) {
    if (!isKeyProblem(error)) throw error;
    const freshSet = await loadKeySet();
    return (await jwtVerify(token, freshSet, { algorithms: ["ES256"] })).payload;
  }
}

async function verifyWith(key: CryptoKey, data: string, signature: string): Promise<boolean> {
  try {
    const bytes = Buffer.from(signature, "base64");
    if (bytes.length !== 64) return false;
    return await crypto.subtle.verify({ name: "Ed25519" }, key, bytes, Buffer.from(data, "utf8"));
  } catch {
    return false;
  }
}

export async function checkNetworkSignature(data: string, signature: string): Promise<boolean> {
  if (typeof signature !== "string" || !signature) return false;
  const key = networkKey ?? (await loadNetworkKey());
  if (await verifyWith(key, data, signature)) return true;
  if (Date.now() - networkLoadedAt < 10_000) return false;
  return verifyWith(await loadNetworkKey(), data, signature);
}

export type Policy = {
  id: string;
  contractId: string;
  modelIds: string[];
  keyId: string;
  params: { subjectType: string; subjectId: string; assignmentId: string; roles: string };
  notBefore: number;
  expiry: number;
  approvedBy: string[];
};

export type SignedPolicy = { policy: Policy; signature: string };

export async function checkPolicySignature(signed: SignedPolicy): Promise<boolean> {
  return checkNetworkSignature(canonicalJson(signed.policy), signed.signature);
}

export async function checkAttestation(
  node: number,
  tag: string,
  digest: string,
  by: string,
  attestation: string,
): Promise<boolean> {
  return checkNetworkSignature(canonicalJson({ node, tag, digest, by }), attestation);
}

export function readPolicyRoles(policy: Policy): string[] | null {
  try {
    const roles = JSON.parse(policy.params.roles);
    return Array.isArray(roles) && roles.every((role) => typeof role === "string") ? roles : null;
  } catch {
    return null;
  }
}
