import express from "express";
import { randomBytes, randomUUID, type webcrypto } from "node:crypto";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { canonicalJson } from "../src/canonical";

const port = Number(process.env.FAKE_TIDE_PORT ?? 4199);
const issuer = `http://localhost:${port}`;

const people: Record<string, { name: string; roles: string[]; groups: string[] }> = {
  "admin.an": { name: "An Nguyen", roles: ["admin"], groups: [] },
  "admin.binh": { name: "Binh Tran", roles: ["admin"], groups: [] },
  "admin.chi": { name: "Chi Le", roles: ["admin"], groups: [] },
  "admin.dung": { name: "Dung Pham", roles: ["admin"], groups: [] },
  "teacher.lan": { name: "Lan Vo", roles: ["teacher", "_tide_encryptor", "_tide_decryptor"], groups: ["/teachers"] },
  "student.minh": { name: "Minh Ho", roles: ["student", "_tide_decryptor"], groups: ["/class-10a"] },
  "student.hoa": { name: "Hoa Dang", roles: ["student", "_tide_decryptor"], groups: ["/class-10a"] },
  "student.khoa": { name: "Khoa Bui", roles: ["student", "_tide_decryptor"], groups: ["/class-10b"] },
};
const userKeys = Object.fromEntries(Object.keys(people).map((name) => [name, randomBytes(32).toString("hex")]));
const userIds = Object.fromEntries(Object.keys(people).map((name) => [name, randomUUID()]));

const jwtKeys = await generateKeyPair("ES256", { extractable: true });
const publicJwk = { ...(await exportJWK(jwtKeys.publicKey)), kid: "fake-1", alg: "ES256", use: "sig" };
const networkKeys = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"])) as unknown as webcrypto.CryptoKeyPair;
const networkRaw = Buffer.from(await crypto.subtle.exportKey("raw", networkKeys.publicKey)).toString("base64");

async function signText(text: string): Promise<string> {
  const signature = await crypto.subtle.sign({ name: "Ed25519" }, networkKeys.privateKey, Buffer.from(text, "utf8"));
  return Buffer.from(signature).toString("base64");
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/jwks", (req, res) => {
  res.json({ keys: [publicJwk] });
});

app.get("/network", (req, res) => {
  res.json({
    networkKey: networkRaw,
    threshold: 3,
    nodes: [1, 2, 3, 4, 5].map((id) => ({ id, publicKey: "", online: true })),
  });
});

app.post("/login", async (req, res) => {
  const username = req.body?.username as string;
  const person = people[username];
  if (!person) {
    res.status(404).json({ error: "Unknown user" });
    return;
  }
  const token = await new SignJWT({
    preferred_username: username,
    name: person.name,
    realm_access: { roles: person.roles },
    groups: person.groups,
    tideuserkey: userKeys[username],
  })
    .setProtectedHeader({ alg: "ES256", kid: "fake-1" })
    .setIssuer(issuer)
    .setSubject(userIds[username])
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(jwtKeys.privateKey);
  res.json({ token, user: { username, ...person, tideuserkey: userKeys[username] } });
});

app.post("/sign-policy", async (req, res) => {
  const policy = req.body?.policy;
  res.json({ policy, signature: await signText(canonicalJson(policy)) });
});

app.post("/attest", async (req, res) => {
  const { node, tag, digest, by } = req.body ?? {};
  res.json({ node, attestation: await signText(canonicalJson({ node, tag, digest, by })) });
});

app.listen(port, () => {
  console.log(`fake tide listening on ${issuer}`);
});
