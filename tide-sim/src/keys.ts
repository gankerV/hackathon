import { exportJWK, generateKeyPair, importJWK, type JWK } from "jose";
import { fromBase64, toBase64, utf8 } from "./bytes.ts";
import type { NodeRecord, StoredKeys } from "./types.ts";

const subtle = globalThis.crypto.subtle;
const curve = { name: "ECDH", namedCurve: "P-256" } as const;

type LoadedKeys = {
  tokenPrivate: CryptoKey;
  tokenPublic: CryptoKey;
  tokenPublicJwk: JWK;
  networkPrivate: CryptoKey;
  networkPublic: CryptoKey;
  networkPublicRaw: string;
  nodePrivate: Map<number, CryptoKey>;
};

let loaded: LoadedKeys | null = null;

export function getKeys(): LoadedKeys {
  if (!loaded) throw new Error("Keys are not loaded.");
  return loaded;
}

export async function createKeys(): Promise<StoredKeys> {
  const token = await generateKeyPair("ES256", { extractable: true });
  const tokenPublic = await exportJWK(token.publicKey);
  tokenPublic.kid = "tide-sim-" + Date.now().toString(36);
  tokenPublic.alg = "ES256";
  tokenPublic.use = "sig";
  const tokenPrivate = await exportJWK(token.privateKey);
  tokenPrivate.kid = tokenPublic.kid;
  tokenPrivate.alg = "ES256";
  const network = (await subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as CryptoKeyPair;
  return {
    tokenPrivate,
    tokenPublic,
    networkPrivate: toBase64(await subtle.exportKey("pkcs8", network.privateKey)),
    networkPublic: toBase64(await subtle.exportKey("raw", network.publicKey)),
  };
}

export async function createNode(id: number): Promise<NodeRecord> {
  const pair = (await subtle.generateKey(curve, true, ["deriveBits"])) as CryptoKeyPair;
  return {
    id,
    privateKey: toBase64(await subtle.exportKey("pkcs8", pair.privateKey)),
    publicKey: toBase64(await subtle.exportKey("raw", pair.publicKey)),
    online: true,
  };
}

export async function loadKeys(stored: StoredKeys, nodes: NodeRecord[]): Promise<void> {
  const nodePrivate = new Map<number, CryptoKey>();
  for (const node of nodes) {
    nodePrivate.set(node.id, await subtle.importKey("pkcs8", fromBase64(node.privateKey), curve, false, ["deriveBits"]));
  }
  loaded = {
    tokenPrivate: (await importJWK(stored.tokenPrivate, "ES256")) as CryptoKey,
    tokenPublic: (await importJWK(stored.tokenPublic, "ES256")) as CryptoKey,
    tokenPublicJwk: stored.tokenPublic,
    networkPrivate: await subtle.importKey("pkcs8", fromBase64(stored.networkPrivate), { name: "Ed25519" }, false, ["sign"]),
    networkPublic: await subtle.importKey("raw", fromBase64(stored.networkPublic), { name: "Ed25519" }, true, ["verify"]),
    networkPublicRaw: stored.networkPublic,
    nodePrivate,
  };
}

export async function signWithNetwork(text: string): Promise<string> {
  return toBase64(await subtle.sign({ name: "Ed25519" }, getKeys().networkPrivate, utf8(text)));
}

export async function verifyWithNetwork(text: string, signature: string): Promise<boolean> {
  try {
    return await subtle.verify({ name: "Ed25519" }, getKeys().networkPublic, fromBase64(signature), utf8(text));
  } catch {
    return false;
  }
}
