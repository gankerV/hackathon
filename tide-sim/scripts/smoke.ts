import { canonicalJson } from "../src/canonical.ts";

const BASE = process.env.TIDE_SIM_URL ?? "http://localhost:4100";
const subtle = globalThis.crypto.subtle;
const curve = { name: "ECDH", namedCurve: "P-256" } as const;
const encoder = new TextEncoder();
let failures = 0;

function toBase64(data: ArrayBuffer | Uint8Array): string {
  return Buffer.from(data instanceof Uint8Array ? data : new Uint8Array(data)).toString("base64");
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> {
  return new Uint8Array(Buffer.from(text, "base64"));
}

function report(name: string, passed: boolean, detail: unknown) {
  if (!passed) failures++;
  console.log(`${passed ? "PASS" : "FAIL"} ${name} -> ${JSON.stringify(detail)}`);
}

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = "Bearer " + token;
  const response = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  return { status: response.status, body: await response.json() };
}

async function signIn(username: string): Promise<string> {
  return (await call("POST", "/login", { username })).body.token;
}

async function wrapShare(share: Uint8Array<ArrayBuffer>, nodePublicKey: string, tag: string) {
  const ephemeral = (await subtle.generateKey(curve, true, ["deriveBits"])) as CryptoKeyPair;
  const nodeKey = await subtle.importKey("raw", fromBase64(nodePublicKey), curve, false, []);
  const bits = await subtle.deriveBits({ name: "ECDH", public: nodeKey }, ephemeral.privateKey, 256);
  const base = await subtle.importKey("raw", bits, "HKDF", false, ["deriveKey"]);
  const key = await subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: encoder.encode("exam-vault-share:" + tag) },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"],
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await subtle.encrypt({ name: "AES-GCM", iv, additionalData: encoder.encode(tag) }, key, share);
  return { ephemeralPublicKey: toBase64(await subtle.exportKey("raw", ephemeral.publicKey)), iv: toBase64(iv), data: toBase64(data) };
}

async function makeSignedPolicy(admins: string[], tokens: Record<string, string>, payload: Record<string, unknown>) {
  const created = await call("POST", "/change-requests", { type: "policy.sign", payload }, tokens[admins[0]]);
  let last = created;
  for (const admin of admins) last = await call("POST", `/change-requests/${created.body.id}/approve`, {}, tokens[admin]);
  return last.body;
}

async function main() {
  const network = (await call("GET", "/network")).body;
  report("GET /network", network.nodes?.length === 5 && fromBase64(network.nodes[0].publicKey).length === 65, {
    threshold: network.threshold,
    networkKeyBytes: fromBase64(network.networkKey).length,
  });

  const admins = ["admin.an", "admin.binh", "admin.chi"];
  const tokens: Record<string, string> = {};
  for (const admin of admins) tokens[admin] = await signIn(admin);

  const tag = "slot_smoke_" + Date.now();
  const now = Math.floor(Date.now() / 1000);
  const request = await makeSignedPolicy(admins, tokens, {
    subjectType: "Group",
    subjectId: "/class-10a",
    assignmentId: tag,
    access: "read",
    notBefore: 0,
    expiry: now + 3600,
    label: "Smoke class policy",
  });
  report("policy.sign CR committed", request.status === "COMMITTED" && !!request.result?.signature, {
    status: request.status,
    approvedBy: request.result?.policy?.approvedBy,
    roles: request.result?.policy?.params?.roles,
  });
  const signedPolicy = request.result;

  const networkKey = await subtle.importKey("raw", fromBase64(network.networkKey), { name: "Ed25519" }, false, ["verify"]);
  const policyValid = await subtle.verify(
    { name: "Ed25519" },
    networkKey,
    fromBase64(signedPolicy.signature),
    encoder.encode(canonicalJson(signedPolicy.policy)),
  );
  report("policy signature verifies under network key", policyValid, { policyValid });

  const share = crypto.getRandomValues(new Uint8Array(32));
  const wrappedShare = await wrapShare(share, network.nodes[0].publicKey, tag);

  const minh = await call("POST", "/ork/1/release-share", { signedPolicy, tag, wrappedShare }, await signIn("student.minh"));
  report("release-share as student.minh", minh.status === 200 && minh.body.share === toBase64(share), {
    status: minh.status,
    node: minh.body.node,
    shareMatches: minh.body.share === toBase64(share),
  });

  const khoa = await call("POST", "/ork/1/release-share", { signedPolicy, tag, wrappedShare }, await signIn("student.khoa"));
  report("release-share as student.khoa refused", khoa.status === 403, { status: khoa.status, body: khoa.body });

  const wrongTag = await call("POST", "/ork/1/release-share", { signedPolicy, tag: "other", wrappedShare }, await signIn("student.minh"));
  report("release-share with wrong tag refused", wrongTag.status === 403, { status: wrongTag.status, body: wrongTag.body });

  const teacherKey = (await call("GET", "/users", undefined, tokens["admin.an"])).body.find(
    (user: { username: string }) => user.username === "teacher.lan",
  ).tideuserkey;
  const teacherRequest = await makeSignedPolicy(admins, tokens, {
    subjectType: "User",
    subjectId: teacherKey,
    assignmentId: tag,
    access: "read-write",
    notBefore: 0,
    expiry: now + 3600,
    label: "Smoke teacher policy",
  });
  const digest = toBase64(await subtle.digest("SHA-256", encoder.encode("bundle core")));
  const attest = await call("POST", "/ork/2/authorize-encrypt", { signedPolicy: teacherRequest.result, tag, digest }, await signIn("teacher.lan"));
  const statement = canonicalJson({ node: 2, tag, digest, by: "teacher.lan" });
  const attestValid =
    attest.status === 200 &&
    (await subtle.verify({ name: "Ed25519" }, networkKey, fromBase64(attest.body.attestation), encoder.encode(statement)));
  report("authorize-encrypt as teacher.lan", attestValid, { status: attest.status, node: attest.body.node, attestValid });

  const studentEncrypt = await call("POST", "/ork/2/authorize-encrypt", { signedPolicy, tag, digest }, await signIn("student.minh"));
  report("authorize-encrypt as student.minh refused", studentEncrypt.status === 403, { status: studentEncrypt.status, body: studentEncrypt.body });

  console.log(failures === 0 ? "ALL PASSED" : `${failures} FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

await main();
