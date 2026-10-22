import { fromBase64, randomBytes, toBase64, utf8 } from "./bytes";
import { canonicalJson } from "./canonical";
import { SHARE_INFO } from "./config";
import type { WrappedShare } from "./types";

async function shareKey(privateKey: CryptoKey, publicKey: CryptoKey, tag: string) {
  const bits = await crypto.subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const base = await crypto.subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: utf8(SHARE_INFO + tag) }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function wrapShare(share: Uint8Array<ArrayBuffer>, nodePublicKey: string, tag: string): Promise<WrappedShare> {
  const nodeKey = await crypto.subtle.importKey("raw", fromBase64(nodePublicKey), { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ephemeral = (await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"])) as CryptoKeyPair;
  const key = await shareKey(ephemeral.privateKey, nodeKey, tag);
  const iv = randomBytes(12);
  const data = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: utf8(tag) }, key, share);
  const raw = await crypto.subtle.exportKey("raw", ephemeral.publicKey);
  return { ephemeralPublicKey: toBase64(raw), iv: toBase64(iv), data: toBase64(data) };
}

export async function sealText(plaintext: string, tag: string) {
  const keyBytes = randomBytes(32);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt"]);
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: utf8(tag) }, key, utf8(plaintext));
  return { keyBytes, iv: toBase64(iv), ciphertext: toBase64(ciphertext) };
}

export async function openText(keyBytes: Uint8Array<ArrayBuffer>, iv: string, ciphertext: string, tag: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromBase64(iv), additionalData: utf8(tag) }, key, fromBase64(ciphertext));
  return new TextDecoder().decode(plain);
}

const networkKeys = new Map<string, Promise<CryptoKey>>();

function networkKey(value: string) {
  let key = networkKeys.get(value);
  if (!key) {
    key = crypto.subtle.importKey("raw", fromBase64(value), { name: "Ed25519" }, false, ["verify"]);
    networkKeys.set(value, key);
  }
  return key;
}

export async function checkSignature(networkKeyValue: string, message: unknown, signature: string) {
  try {
    const key = await networkKey(networkKeyValue);
    return await crypto.subtle.verify({ name: "Ed25519" }, key, fromBase64(signature), utf8(canonicalJson(message)));
  } catch {
    return false;
  }
}
