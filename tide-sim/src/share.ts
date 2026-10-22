import { fromBase64, toBase64, utf8 } from "./bytes.ts";
import { Refusal, type WrappedShare } from "./types.ts";

const subtle = globalThis.crypto.subtle;
const curve = { name: "ECDH", namedCurve: "P-256" } as const;

async function makeShareKey(privateKey: CryptoKey, publicKey: CryptoKey, tag: string, usage: KeyUsage): Promise<CryptoKey> {
  const bits = await subtle.deriveBits({ name: "ECDH", public: publicKey }, privateKey, 256);
  const base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  return subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: utf8("exam-vault-share:" + tag) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    [usage],
  );
}

export async function unwrapShare(nodePrivateKey: CryptoKey, tag: string, wrapped: WrappedShare): Promise<string> {
  if (!wrapped?.ephemeralPublicKey || !wrapped.iv || !wrapped.data) throw new Refusal(400, "Missing wrapped share.");
  try {
    const ephemeral = await subtle.importKey("raw", fromBase64(wrapped.ephemeralPublicKey), curve, false, []);
    const key = await makeShareKey(nodePrivateKey, ephemeral, tag, "decrypt");
    const share = await subtle.decrypt(
      { name: "AES-GCM", iv: fromBase64(wrapped.iv), additionalData: utf8(tag) },
      key,
      fromBase64(wrapped.data),
    );
    return toBase64(share);
  } catch {
    throw new Refusal(400, "Share could not be unwrapped.");
  }
}
