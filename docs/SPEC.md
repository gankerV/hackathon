# Exam Vault — Build Spec

Teachers encrypt exam papers in the browser before exam day. At exam time, only students of the class can fetch and decrypt them. No admin and no backend can read or alter an exam. Granting any access needs a quorum of 3 admins.

This prototype runs in **simulated TideCloak mode**. It keeps Tide's real model (the `RelationshipAttestation:1` policy shape, `doEncrypt`/`doDecrypt`, IGA change requests with quorum approval, and threshold ORK nodes), simulated locally by `tide-sim`. A later step can swap `tide-sim` for real TideCloak, with no change to the backend or the web data model.

## Global rules

- TypeScript everywhere. Node 24 (has `globalThis.crypto.subtle` and `node:sqlite`).
- **No comments in code.** Function names use plain, common English words (`getExam`, `saveExam`, `checkPolicy`).
- English UI text.
- No `.env` secrets are committed. Generated key material lives in `*/data/` (gitignored).

## Services and ports

| Service | Folder | Port | Role |
|---|---|---|---|
| tide-sim | `tide-sim/` | 4100 | Simulated TideCloak: sign-in (JWT issuer), users/roles/groups, IGA change requests with 3-admin quorum, policy signing, 5 ORK nodes (threshold 3) |
| backend | `backend/` | 4000 | Express + `node:sqlite`. Classes, exam slots, ciphertext storage, signed policy storage, exam-time gate (server clock), hash-chained audit log |
| web | `web/` | 3000 | Next.js App Router. Design system + Teacher / Student / Admin screens. All encryption and decryption happen here |

Run each with `npm run dev`. CORS: tide-sim and backend allow `http://localhost:3000`, with an `Authorization` header.

## Demo identities (seeded in tide-sim)

| username | name | roles | groups |
|---|---|---|---|
| admin.an | An Nguyen | admin | — |
| admin.binh | Binh Tran | admin | — |
| admin.chi | Chi Le | admin | — |
| admin.dung | Dung Pham | admin | — |
| teacher.lan | Lan Vo | teacher, _tide_encryptor, _tide_decryptor | /teachers |
| student.minh | Minh Ho | student, _tide_decryptor | /class-10a |
| student.hoa | Hoa Dang | student, _tide_decryptor | /class-10a |
| student.khoa | Khoa Bui | student, _tide_decryptor | /class-10b |

Each user also has a stable `tideuserkey` (random 32-byte hex, generated once and persisted).

Admin threshold: **3**. ORK nodes: **5**, threshold **3**.

## Token (JWT) issued by tide-sim

The token is signed with ES256 (ECDSA P-256). The public key is served as JWK at `GET /jwks`, in the shape `{ keys: [jwk] }`. It expires 1 hour after issue.

```json
{ "iss": "http://localhost:4100", "sub": "<userId>", "preferred_username": "teacher.lan", "name": "Lan Vo",
  "realm_access": { "roles": ["teacher","_tide_encryptor","_tide_decryptor"] },
  "groups": ["/teachers"], "tideuserkey": "<hex>", "iat": 0, "exp": 0 }
```

Use the `jose` npm package in tide-sim, the backend and the web.

## Policy (RelationshipAttestation:1 shape)

```json
{
  "id": "pol_<random>",
  "contractId": "RelationshipAttestation:1",
  "modelIds": ["PolicyEnabledEncryption:1", "PolicyEnabledDecryption:1"],
  "keyId": "exam-vault",
  "params": {
    "subjectType": "User | Group | Role",
    "subjectId": "<tideuserkey> | /class-10a | teacher",
    "assignmentId": "<slotId>",
    "roles": "[\"_tide_decryptor\"]"
  },
  "notBefore": 0,
  "expiry": 0,
  "approvedBy": ["admin.an", "admin.binh", "admin.chi"]
}
```

- `notBefore` and `expiry` are unix seconds. `notBefore` may be 0, and `expiry` must be > 0.
- `roles` is a JSON array **written as a string**.
- **Signed policy** = `{ policy, signature }`. `signature` is base64 Ed25519 over `canonical(policy)`. `canonical` is JSON.stringify with keys sorted recursively, so the `canonicalJson` helper must be identical in all three services. The network signing key is Ed25519. Its public key is served at `GET /network` as `{ networkKey: <base64 raw 32 bytes>, threshold: 3, nodes: [{ id: 1..5, publicKey: <base64 raw P-256 public key, uncompressed 65 bytes>, online: true }] }`.

## tide-sim API (port 4100)

State is persisted to `tide-sim/data/state.json`: users, keys, change requests and node online flags. Keys are generated on first start.

| Method | Path | Auth | Behaviour |
|---|---|---|---|
| GET | /jwks | none | JWT public key |
| GET | /network | none | network key + nodes, as above |
| GET | /demo-users | none | list `{username, name, roles, groups}` for the persona picker |
| POST | /login | none | `{username}` → `{token, user}` (simulated passwordless Tide sign-in) |
| GET | /users | admin | all users with roles, groups and tideuserkey |
| GET | /change-requests | admin | all CRs, newest first |
| POST | /change-requests | admin | create a CR (see types) → CR |
| POST | /change-requests/:id/approve | admin | add the caller's approval. The same admin cannot approve twice (409). At 3 distinct approvals → apply, status `COMMITTED`, `result` set |
| POST | /change-requests/:id/reject | admin | status `REJECTED` |
| POST | /ork/:node/toggle | none | flip a node online/offline (demo) |
| POST | /ork/:node/authorize-encrypt | bearer | see ORK checks |
| POST | /ork/:node/release-share | bearer | see ORK checks |

CR object: `{ id, type, payload, status: "PENDING"|"COMMITTED"|"REJECTED", approvals: [{username, at}], createdBy, createdAt, committedAt?, result? }`.

CR types and payloads:
- `user.addRole` / `user.removeRole` `{ username, role }`
- `user.addGroup` / `user.removeGroup` `{ username, group }`
- `policy.sign` `{ subjectType, subjectId, assignmentId, access: "read"|"write"|"read-write", notBefore, expiry, label }` → on commit, `result = signedPolicy`. `approvedBy` = the approving admins.

The creator's own approval is **not** added automatically. Any admin, including the creator, approves explicitly.

### ORK node checks (each node is independent and has its own P-256 ECDH keypair)

`authorize-encrypt` body: `{ signedPolicy, tag, digest }`. `digest` is the base64 SHA-256 of the ciphertext bundle core (see the web section). The node checks:
1. The node is online (else 503).
2. The bearer JWT is valid.
3. The policy signature is valid under the network key.
4. The time is now in [notBefore, expiry).
5. `params.assignmentId === tag`.
6. The subject matches the caller: `User` → `tideuserkey`, `Group` → `groups` includes it, `Role` → realm role.
7. The policy `roles` includes `_tide_encryptor`, **and** the caller holds the realm role `_tide_encryptor`.

Returns `{ node, attestation }`. `attestation` = base64 Ed25519 signature by the network key over `canonical({ node, tag, digest, by: preferred_username })`. In the sim, the nodes share the network key for attestation.

`release-share` body: `{ signedPolicy, tag, wrappedShare: { ephemeralPublicKey, iv, data } }`. The node runs the same checks 1–6. Check 7 uses `_tide_decryptor`. The node then unwraps the share: ECDH (its private key, ephemeralPublicKey) → HKDF-SHA256 (salt empty, info `"exam-vault-share:" + tag`) → AES-GCM-256 key, decrypted with `additionalData = utf8(tag)`. It returns `{ node, share: <base64> }`.

A refusal returns 403 `{ error: "<reason>" }`, with contract-like messages such as `"Tags do not contain assignmentId."`, `"'/class-10a' group not found in doken."`, `"_tide_decryptor not found in list of roles."`, `"Policy not yet valid."` and `"Policy expired."`.

## backend API (port 4000)

The backend verifies the JWT on every `/api` route except `/api/time`, using the JWKS fetched from tide-sim. It verifies a signed policy against the network key from tide-sim `/network` before storing it. **It never holds key shares and cannot decrypt.**

SQLite tables: `classes(id, name, groupPath)`, `slots(id, classId, title, kind, startsAt, endsAt, teacher)`, `exams(slotId PK, bundle TEXT, digest, attestations TEXT, uploadedBy, uploadedAt)`, `policies(id PK, slotId, audience, subjectType, subjectId, signed TEXT, createdAt)`, `audit(id, at, actor, action, target, detail, prevHash, hash)`.

- `audience` ∈ `teacher` | `class` | `admin`.
- Times are ISO strings in slots, as returned by the API.
- Seed data: classes `10A` (`/class-10a`) and `10B` (`/class-10b`).
- Audit `hash` = sha256(prevHash + canonical({at, actor, action, target, detail})).

| Method | Path | Who | Behaviour |
|---|---|---|---|
| GET | /api/time | none | `{ now }` server ISO time |
| GET | /api/me | any | token claims |
| GET | /api/classes | any | list |
| POST | /api/classes | admin | `{name, groupPath}` |
| GET | /api/slots | admin: all; teacher: theirs; student: their class groups | each slot + `{ status: "upcoming"|"open"|"closed", hasExam, policies: {teacher: bool, class: bool} }` |
| POST | /api/slots | admin | `{classId, title, kind: "midterm"|"final", startsAt, endsAt, teacher}`. Max 2 slots per class per term (one midterm, one final) → 409 otherwise |
| POST | /api/policies | admin | `{slotId, audience, signedPolicy}`. Verifies the signature, that `assignmentId === slotId`, and that the subject matches the audience (`class` → slot's class groupPath, read-only; `teacher` → User subject; `admin` → User subject, read-only) |
| GET | /api/policies/mine?slotId= | any | the signed policy usable by the caller: teacher → teacher policy if they are the slot's teacher; student → class policy if they are in the group; admin → an admin policy whose subjectId === their tideuserkey. 404 if none |
| PUT | /api/exams/:slotId | teacher of slot | `{bundle, digest, attestations: [{node, attestation}]}`. Requires ≥3 valid distinct-node attestations over `{node, tag: slotId, digest, by: caller}` and a recomputed digest that matches. Refused (423) once `now >= startsAt` |
| GET | /api/exams/:slotId | see gate | Teacher of slot: any time. Student in class: 425 `{error:"Exam not open yet", opensAt, now}` before `startsAt`, 410 after `endsAt`. Admin: ciphertext only (`access: "ciphertext"`) unless a stored admin policy names them (`access: "policy"`). Returns `{access, bundle, digest, attestations, uploadedBy, uploadedAt}` |
| POST | /api/audit | any | client-reported event `{action, target, detail}` (e.g. `exam.decrypt.ok`, `exam.decrypt.denied`, `cr.create`, `cr.approve`) |
| GET | /api/audit | admin | entries newest first + `{ chainValid: bool }` |

The backend writes audit entries for: class/slot create, policy store, exam upload, exam fetch (allowed and denied with reason), and admin attempts to fetch exams.

## web (port 3000)

Next.js App Router, TypeScript, CSS Modules + a global token stylesheet. **The design system comes first** (tokens + components + a `/design-system` showcase page), then the screens.

Sim SDK at `web/src/lib/tide/` mirrors the real Tide SDK names:
- `signIn(username)` and `signOut()`. The token lives in `sessionStorage`. `useTide()` returns `{ user, token, hasRole, doEncrypt, doDecrypt }`.
- `doEncrypt(plaintext, tag, signedPolicy)`: (1) random AES-GCM-256 data key, encrypt the UTF-8 plaintext; (2) Shamir-split the 32-byte key into 5 shares, threshold 3, over GF(256); (3) wrap share i to node i's public key (ephemeral ECDH P-256 → HKDF → AES-GCM, AAD = tag); (4) bundle core = `{ v: 1, tag, iv, ciphertext, shares: [{node, wrappedShare}] }`, digest = base64 sha256(canonical(core)); (5) call `authorize-encrypt` on every online node and collect ≥3 attestations. Returns `{ bundle: core, digest, attestations }`.
- `doDecrypt(bundle, tag, signedPolicy, onProgress)`: call `release-share` on the nodes, report each node's result through `onProgress`, combine ≥3 shares (Lagrange at x=0), AES-GCM decrypt, then verify the digest and that ≥3 attestations are valid under the network key before returning the plaintext.
- `canonicalJson` is identical to tide-sim's and the backend's.

Screens:
- `/`: product story + "Sign in with Tide" persona picker (simulated).
- `/teacher`: the teacher's slots. Exam editor (title, plain-text questions). "Encrypt & seal" shows per-node attestations, then uploads. "Review my exam" decrypts using the teacher policy.
- `/student`: class slots with a server-time countdown. When open: fetch and decrypt with a live 5-node threshold visual, then a read-only exam view.
- `/admin` tabs: **Users & roles** (propose role/group CRs), **Classes & exams** (create slots; "Prepare policies" proposes 2 `policy.sign` CRs per slot: teacher read-write `User`, class read-only `Group` with expiry = endsAt), **Approvals** (CR queue, approve/reject, `n/3` progress; on commit of a policy CR the admin's browser stores it at `POST /api/policies`), **Access to exam** (propose an admin read-only policy for a slot; the try-to-open button shows the refusal until quorum), **Audit log** (with chain-valid badge), **Network** (5 nodes, toggle online).
- A persona switcher in the header makes quorum demos quick.
