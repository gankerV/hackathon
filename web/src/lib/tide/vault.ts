import { fromBase64, randomBytes, sha256Base64, toBase64 } from "./bytes";
import { canonicalJson } from "./canonical";
import { TideError, callTide, getNetwork } from "./client";
import { NODE_COUNT, NODE_THRESHOLD } from "./config";
import { checkSignature, openText, sealText, wrapShare } from "./crypto";
import { combineShares, splitSecret } from "./shamir";
import type { Attestation, BundleCore, SealedExam, SignedPolicy, VaultEvent, WrappedShare } from "./types";
import type { Share } from "./shamir";

type Listener = (event: VaultEvent) => void;

const NODE_TIMEOUT = 6000;

export class VaultError extends Error {
  reasons: { node: number; reason: string; kind: string }[];
  constructor(message: string, reasons: { node: number; reason: string; kind: string }[] = []) {
    super(message);
    this.reasons = reasons;
  }
}

function emit(listener: Listener | undefined, event: VaultEvent) {
  try {
    listener?.(event);
  } catch {}
}

async function askNode<T>(node: number, action: "authorize-encrypt" | "release-share", body: unknown) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NODE_TIMEOUT);
  try {
    return await callTide<T>(`/ork/${node}/${action}`, { body, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function describeFailure(error: unknown) {
  if (error instanceof TideError) {
    if (error.kind === "refused") return { state: "refused" as const, reason: error.message, kind: "refused" };
    if (error.kind === "offline" || error.kind === "unreachable") return { state: "offline" as const, reason: error.kind === "offline" ? "Node is offline." : error.message, kind: "offline" };
    if (error.kind === "auth") return { state: "refused" as const, reason: `Sign-in not accepted: ${error.message}`, kind: "auth" };
    return { state: "refused" as const, reason: error.message, kind: error.kind };
  }
  return { state: "offline" as const, reason: "No answer from node.", kind: "offline" };
}

function summarize(reasons: { reason: string; kind: string }[]) {
  const refused = reasons.filter((item) => item.kind !== "offline");
  if (refused.length > 0) return `Access refused by the network: ${refused[0].reason}`;
  return "Not enough ORK nodes are online to reach the threshold.";
}

export function bundleDigest(core: BundleCore) {
  return sha256Base64(canonicalJson(core));
}

export async function doEncrypt(plaintext: string, tag: string, signedPolicy: SignedPolicy, onProgress?: Listener): Promise<SealedExam> {
  const network = await getNetwork();
  emit(onProgress, { kind: "step", step: "encrypt", state: "active" });
  const sealed = await sealText(plaintext, tag);
  emit(onProgress, { kind: "step", step: "encrypt", state: "done", detail: "AES-GCM-256 with a fresh data key" });

  emit(onProgress, { kind: "step", step: "split", state: "active" });
  const nodes = [...network.nodes].sort((a, b) => a.id - b.id).slice(0, NODE_COUNT);
  const pieces = splitSecret(sealed.keyBytes, nodes.length, NODE_THRESHOLD);
  sealed.keyBytes.fill(0);
  emit(onProgress, { kind: "step", step: "split", state: "done", detail: `${nodes.length} shares, any ${NODE_THRESHOLD} rebuild the key` });

  emit(onProgress, { kind: "step", step: "wrap", state: "active" });
  const shares = await Promise.all(
    nodes.map(async (node, index) => {
      const piece = new Uint8Array(pieces[index].y);
      const wrapped = await wrapShare(piece, node.publicKey, tag);
      piece.fill(0);
      return { node: node.id, wrappedShare: wrapped };
    }),
  );
  pieces.forEach((piece) => piece.y.fill(0));
  emit(onProgress, { kind: "step", step: "wrap", state: "done", detail: "Each share sealed to one node's public key" });

  const bundle: BundleCore = { v: 1, tag, iv: sealed.iv, ciphertext: sealed.ciphertext, shares };
  const digest = await bundleDigest(bundle);

  emit(onProgress, { kind: "step", step: "attest", state: "active" });
  const reasons: { node: number; reason: string; kind: string }[] = [];
  const attestations: Attestation[] = [];
  await Promise.all(
    nodes.map(async (node) => {
      emit(onProgress, { kind: "node", node: node.id, state: "pending" });
      try {
        const answer = await askNode<{ node: number; attestation: string }>(node.id, "authorize-encrypt", { signedPolicy, tag, digest });
        attestations.push({ node: Number(answer.node ?? node.id), attestation: answer.attestation });
        emit(onProgress, { kind: "node", node: node.id, state: "ok", detail: `attestation ${answer.attestation.slice(0, 16)}…` });
      } catch (error) {
        const failure = describeFailure(error);
        reasons.push({ node: node.id, reason: failure.reason, kind: failure.kind });
        emit(onProgress, { kind: "node", node: node.id, state: failure.state, detail: failure.reason });
      }
    }),
  );
  if (attestations.length < NODE_THRESHOLD) {
    emit(onProgress, { kind: "step", step: "attest", state: "failed", detail: summarize(reasons) });
    throw new VaultError(summarize(reasons), reasons);
  }
  attestations.sort((a, b) => a.node - b.node);
  emit(onProgress, { kind: "step", step: "attest", state: "done", detail: `${attestations.length} of ${nodes.length} nodes attested the digest` });
  return { bundle, digest, attestations };
}

export async function releaseShares(bundle: BundleCore, tag: string, signedPolicy: SignedPolicy, onProgress?: Listener) {
  const reasons: { node: number; reason: string; kind: string }[] = [];
  const shares: Share[] = [];
  await Promise.all(
    bundle.shares.map(async (item) => {
      emit(onProgress, { kind: "node", node: item.node, state: "pending" });
      try {
        const answer = await askNode<{ node: number; share: string }>(item.node, "release-share", { signedPolicy, tag, wrappedShare: item.wrappedShare });
        shares.push({ x: item.node, y: fromBase64(answer.share) });
        emit(onProgress, { kind: "node", node: item.node, state: "ok", detail: "Share released over the policy" });
      } catch (error) {
        const failure = describeFailure(error);
        reasons.push({ node: item.node, reason: failure.reason, kind: failure.kind });
        emit(onProgress, { kind: "node", node: item.node, state: failure.state, detail: failure.reason });
      }
    }),
  );
  return { shares: shares.sort((a, b) => a.x - b.x), reasons };
}

export async function doDecrypt(sealed: SealedExam, tag: string, signedPolicy: SignedPolicy, onProgress?: Listener): Promise<string> {
  const bundle = sealed.bundle;
  if (bundle.tag !== tag) throw new VaultError("This paper belongs to a different exam slot.");
  const network = await getNetwork();

  emit(onProgress, { kind: "step", step: "release", state: "active" });
  const { shares, reasons } = await releaseShares(bundle, tag, signedPolicy, onProgress);
  if (shares.length < NODE_THRESHOLD) {
    emit(onProgress, { kind: "step", step: "release", state: "failed", detail: summarize(reasons) });
    throw new VaultError(summarize(reasons), reasons);
  }
  emit(onProgress, { kind: "step", step: "release", state: "done", detail: `${shares.length} of ${bundle.shares.length} nodes released a share` });

  emit(onProgress, { kind: "step", step: "combine", state: "active" });
  const key = combineShares(shares.slice(0, NODE_THRESHOLD));
  shares.forEach((share) => share.y.fill(0));
  emit(onProgress, { kind: "step", step: "combine", state: "done", detail: `Key rebuilt in this browser from ${NODE_THRESHOLD} shares` });

  emit(onProgress, { kind: "step", step: "decrypt", state: "active" });
  let plaintext: string;
  try {
    plaintext = await openText(key, bundle.iv, bundle.ciphertext, tag);
  } catch {
    emit(onProgress, { kind: "step", step: "decrypt", state: "failed", detail: "The rebuilt key does not open this paper." });
    throw new VaultError("The rebuilt key does not open this paper. It may have been altered.");
  } finally {
    key.fill(0);
  }
  emit(onProgress, { kind: "step", step: "decrypt", state: "done", detail: "AES-GCM authentication tag is valid" });

  emit(onProgress, { kind: "step", step: "verify", state: "active" });
  const digest = await bundleDigest(bundle);
  if (digest !== sealed.digest) {
    emit(onProgress, { kind: "step", step: "verify", state: "failed", detail: "Digest does not match the sealed bundle." });
    throw new VaultError("The paper's digest does not match what the network attested.");
  }
  const by = sealed.uploadedBy ?? "";
  const seen = new Set<number>();
  for (const item of sealed.attestations ?? []) {
    if (seen.has(item.node)) continue;
    const valid = await checkSignature(network.networkKey, { node: item.node, tag, digest, by }, item.attestation);
    if (valid) seen.add(item.node);
  }
  if (seen.size < NODE_THRESHOLD) {
    emit(onProgress, { kind: "step", step: "verify", state: "failed", detail: `Only ${seen.size} valid attestations.` });
    throw new VaultError(`Only ${seen.size} valid node attestations; ${NODE_THRESHOLD} are required.`);
  }
  emit(onProgress, { kind: "step", step: "verify", state: "done", detail: `Digest matches; ${seen.size} node attestations valid for ${by || "the author"}` });
  return plaintext;
}

export async function makeDecoyShares(tag: string): Promise<BundleCore> {
  const network = await getNetwork();
  const shares: { node: number; wrappedShare: WrappedShare }[] = await Promise.all(
    network.nodes.map(async (node) => ({ node: node.id, wrappedShare: await wrapShare(randomBytes(32), node.publicKey, tag) })),
  );
  return { v: 1, tag, iv: toBase64(randomBytes(12)), ciphertext: toBase64(randomBytes(48)), shares };
}
