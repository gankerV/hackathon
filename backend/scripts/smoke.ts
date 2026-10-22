import { canonicalJson, sha256Base64 } from "../src/canonical";

const api = process.env.BACKEND_URL ?? "http://localhost:4000";
const tide = process.env.FAKE_TIDE_URL ?? "http://localhost:4199";

let failures = 0;

function expect(label: string, actual: unknown, wanted: unknown) {
  const ok = actual === wanted;
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}  (got ${String(actual)}, want ${String(wanted)})`);
}

async function call(method: string, path: string, token?: string, body?: unknown) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await response.text();
  return { status: response.status, body: text ? JSON.parse(text) : null };
}

async function tidePost(path: string, body: unknown): Promise<any> {
  const response = await fetch(`${tide}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return response.json();
}

async function login(username: string) {
  return (await tidePost("/login", { username })) as { token: string; user: { tideuserkey: string } };
}

function wait(ms: number) {
  return new Promise((done) => setTimeout(done, ms));
}

function makePolicy(slotId: string, subjectType: string, subjectId: string, roles: string[], expiry: number) {
  return {
    id: `pol_${Math.random().toString(36).slice(2, 10)}`,
    contractId: "RelationshipAttestation:1",
    modelIds: ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
    keyId: "exam-vault",
    params: { subjectType, subjectId, assignmentId: slotId, roles: JSON.stringify(roles) },
    notBefore: 0,
    expiry,
    approvedBy: ["admin.an", "admin.binh", "admin.chi"],
  };
}

const admin = await login("admin.an");
const otherAdmin = await login("admin.binh");
const teacher = await login("teacher.lan");
const student = await login("student.minh");
const outsider = await login("student.khoa");

expect("GET /api/time without token", (await call("GET", "/api/time")).status, 200);
expect("GET /api/me without token", (await call("GET", "/api/me")).status, 401);
expect("GET /api/me with token", (await call("GET", "/api/me", teacher.token)).body?.preferred_username, "teacher.lan");
expect("GET /api/classes seeded", (await call("GET", "/api/classes", student.token)).body?.length, 2);
expect("POST /api/classes as teacher", (await call("POST", "/api/classes", teacher.token, { name: "11A", groupPath: "/class-11a" })).status, 403);
expect("POST /api/classes as admin", (await call("POST", "/api/classes", admin.token, { name: "11A", groupPath: "/class-11a" })).status, 201);

const startsAt = new Date(Date.now() + 6000).toISOString();
const endsAt = new Date(Date.now() + 14000).toISOString();
const created = await call("POST", "/api/slots", admin.token, {
  classId: "class-10a",
  title: "Math midterm",
  kind: "midterm",
  startsAt,
  endsAt,
  teacher: "teacher.lan",
});
expect("POST /api/slots midterm", created.status, 201);
const slotId = created.body.id as string;
const future = new Date(Date.now() + 86400000).toISOString();
const later = new Date(Date.now() + 90000000).toISOString();
const slotBody = { classId: "class-10a", title: "x", startsAt: future, endsAt: later, teacher: "teacher.lan" };
expect("second midterm for 10A", (await call("POST", "/api/slots", admin.token, { ...slotBody, kind: "midterm" })).status, 409);
expect("final for 10A", (await call("POST", "/api/slots", admin.token, { ...slotBody, kind: "final" })).status, 201);
expect("third slot for 10A", (await call("POST", "/api/slots", admin.token, { ...slotBody, kind: "final" })).status, 409);
expect("POST /api/slots as teacher", (await call("POST", "/api/slots", teacher.token, { ...slotBody, classId: "class-10b", kind: "final" })).status, 403);

const expiry = Math.floor(Date.parse(endsAt) / 1000);
const classSigned = await tidePost("/sign-policy", { policy: makePolicy(slotId, "Group", "/class-10a", ["_tide_decryptor"], expiry) });
const teacherSigned = await tidePost("/sign-policy", {
  policy: makePolicy(slotId, "User", teacher.user.tideuserkey, ["_tide_encryptor", "_tide_decryptor"], expiry + 86400),
});
const wrongGroup = await tidePost("/sign-policy", { policy: makePolicy(slotId, "Group", "/class-10b", ["_tide_decryptor"], expiry) });
const forged = { ...classSigned, policy: { ...classSigned.policy, params: { ...classSigned.policy.params, subjectId: "/class-10b" } } };
expect("store class policy", (await call("POST", "/api/policies", admin.token, { slotId, audience: "class", signedPolicy: classSigned })).status, 201);
expect("store same policy again", (await call("POST", "/api/policies", admin.token, { slotId, audience: "class", signedPolicy: classSigned })).status, 200);
expect("store teacher policy", (await call("POST", "/api/policies", admin.token, { slotId, audience: "teacher", signedPolicy: teacherSigned })).status, 201);
expect("class policy for wrong group", (await call("POST", "/api/policies", admin.token, { slotId, audience: "class", signedPolicy: wrongGroup })).status, 400);
expect("forged policy signature", (await call("POST", "/api/policies", admin.token, { slotId, audience: "class", signedPolicy: forged })).status, 400);
expect("store policy as teacher", (await call("POST", "/api/policies", teacher.token, { slotId, audience: "class", signedPolicy: classSigned })).status, 403);
expect("policies/mine teacher", (await call("GET", `/api/policies/mine?slotId=${slotId}`, teacher.token)).body?.policy?.id, teacherSigned.policy.id);
expect("policies/mine student", (await call("GET", `/api/policies/mine?slotId=${slotId}`, student.token)).body?.policy?.id, classSigned.policy.id);
expect("policies/mine outsider", (await call("GET", `/api/policies/mine?slotId=${slotId}`, outsider.token)).status, 404);
expect("policies/mine admin", (await call("GET", `/api/policies/mine?slotId=${slotId}`, admin.token)).status, 404);

const bundle = {
  v: 1,
  tag: slotId,
  iv: "aXY=",
  ciphertext: "Y2lwaGVy",
  shares: [1, 2, 3, 4, 5].map((node) => ({ node, wrappedShare: { ephemeralPublicKey: "k", iv: "i", data: `d${node}` } })),
};
const digest = sha256Base64(canonicalJson(bundle));
const attestations = [];
for (const node of [1, 2, 3]) attestations.push(await tidePost("/attest", { node, tag: slotId, digest, by: "teacher.lan" }));
const wrongBy = await tidePost("/attest", { node: 4, tag: slotId, digest, by: "student.minh" });

expect("upload with 2 attestations", (await call("PUT", `/api/exams/${slotId}`, teacher.token, { bundle, digest, attestations: attestations.slice(0, 2) })).status, 403);
expect("upload with duplicate node", (await call("PUT", `/api/exams/${slotId}`, teacher.token, { bundle, digest, attestations: [attestations[0], attestations[0], attestations[1], wrongBy] })).status, 403);
expect("upload with wrong digest", (await call("PUT", `/api/exams/${slotId}`, teacher.token, { bundle: { ...bundle, iv: "x" }, digest, attestations })).status, 400);
expect("upload as student", (await call("PUT", `/api/exams/${slotId}`, student.token, { bundle, digest, attestations })).status, 403);
expect("upload as teacher with 3 attestations", (await call("PUT", `/api/exams/${slotId}`, teacher.token, { bundle, digest, attestations })).status, 200);

const before = await call("GET", `/api/exams/${slotId}`, student.token);
expect("student fetch before start", before.status, 425);
expect("425 body has opensAt", before.body?.opensAt, startsAt);
expect("outsider fetch", (await call("GET", `/api/exams/${slotId}`, outsider.token)).status, 403);
expect("teacher fetch before start", (await call("GET", `/api/exams/${slotId}`, teacher.token)).status, 200);

const slots = await call("GET", "/api/slots", student.token);
const listed = slots.body.find((slot: { id: string }) => slot.id === slotId);
expect("student slot list hasExam", listed?.hasExam, true);
expect("student slot list status", listed?.status, "upcoming");
expect("student slot list policies.class", listed?.policies?.class, true);
expect("outsider slot list count", (await call("GET", "/api/slots", outsider.token)).body?.length, 0);

console.log("waiting for slot start...");
await wait(Math.max(0, Date.parse(startsAt) - Date.now()) + 500);

const open = await call("GET", `/api/exams/${slotId}`, student.token);
expect("student fetch after start", open.status, 200);
expect("fetched digest matches", open.body?.digest, digest);
expect("fetched bundle digest recomputes", sha256Base64(canonicalJson(open.body?.bundle)), digest);
expect("upload after start", (await call("PUT", `/api/exams/${slotId}`, teacher.token, { bundle, digest, attestations })).status, 423);
expect("admin fetch without policy", (await call("GET", `/api/exams/${slotId}`, admin.token)).status, 403);

const adminSigned = await tidePost("/sign-policy", { policy: makePolicy(slotId, "User", admin.user.tideuserkey, ["_tide_decryptor"], expiry) });
const adminWrite = await tidePost("/sign-policy", { policy: makePolicy(slotId, "User", admin.user.tideuserkey, ["_tide_encryptor", "_tide_decryptor"], expiry) });
expect("store read-write admin policy", (await call("POST", "/api/policies", otherAdmin.token, { slotId, audience: "admin", signedPolicy: adminWrite })).status, 400);
expect("store admin policy", (await call("POST", "/api/policies", otherAdmin.token, { slotId, audience: "admin", signedPolicy: adminSigned })).status, 201);
expect("named admin fetch", (await call("GET", `/api/exams/${slotId}`, admin.token)).status, 200);
expect("other admin fetch", (await call("GET", `/api/exams/${slotId}`, otherAdmin.token)).status, 403);
expect("policies/mine named admin", (await call("GET", `/api/policies/mine?slotId=${slotId}`, admin.token)).body?.policy?.id, adminSigned.policy.id);

expect("client audit event", (await call("POST", "/api/audit", student.token, { action: "exam.decrypt.ok", target: slotId, detail: { nodes: [1, 2, 3] } })).status, 201);

console.log("waiting for slot end...");
await wait(Math.max(0, Date.parse(endsAt) - Date.now()) + 500);
expect("student fetch after end", (await call("GET", `/api/exams/${slotId}`, student.token)).status, 410);

expect("audit as student", (await call("GET", "/api/audit", student.token)).status, 403);
const audit = await call("GET", "/api/audit", admin.token);
expect("audit chainValid", audit.body?.chainValid, true);
const actions = new Set(audit.body?.entries?.map((entry: { action: string }) => entry.action));
for (const action of ["class.create", "slot.create", "policy.store", "exam.upload", "exam.fetch", "exam.fetch.admin", "exam.decrypt.ok"]) {
  expect(`audit has ${action}`, actions.has(action), true);
}
expect("audit newest first", audit.body.entries[0].id > audit.body.entries[audit.body.entries.length - 1].id, true);
console.log(`audit entries: ${audit.body.entries.length}`);

console.log(failures === 0 ? "ALL PASS" : `${failures} FAILED`);
process.exit(failures === 0 ? 0 : 1);
