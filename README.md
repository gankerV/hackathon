# Exam Vault

[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

Exam Vault seals exam papers in the teacher's browser so only the class can open them, only at exam time, and no admin or server can read them.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked).

[Watch the demo video](demo/exam-vault-demo.mp4)

### 1. Vision & originality

The paper itself is protected, not the server that stores it. A teacher seals it on their own device, and it stays sealed until the class sits the exam, under a policy three admins signed.

### 2. Trust constraint insight

Papers leak through whoever holds the keys: an IT admin, a shared drive, a compromised server. Schools fall back on USB sticks and locked cabinets. Remove that trust and papers can be prepared early, digitally.

### 3. Value & impact

- Teachers prepare papers early without fear of leaks.
- Students get a fair exam.
- Schools can prove through a hash-chained audit log that no admin opened a paper.

An IT admin with full server access still cannot read Grade 10's final the night before.

### 4. Why TideCloak matters

The decryption key never exists in one place. It is split across ORK nodes. Each node checks the caller's class group, the `_tide_decryptor` role and a quorum-signed `RelationshipAttestation:1` policy (tag = exam slot, read-only, valid only during the exam). The backend stores only ciphertext and gates release by server time. Any role, group or policy change needs 3 admin approvals.

The prototype runs in simulated TideCloak mode (`tide-sim`).

### 5. Prototype & storytelling

Look for three moments:

1. A teacher seals a paper and the nodes attest it.
2. A student is refused before the start time, then decrypts at the start time as 3 of 5 nodes release key shares.
3. An admin sees only ciphertext, and all 5 nodes refuse a forged policy.

## Setup

Requires Node 24. One command starts everything:

```bash
./dev.sh
```

Or start each service separately:

```bash
cd tide-sim && npm install && npm run dev
cd backend  && npm install && npm run dev
cd web      && npm install && npm run dev
```

Open http://localhost:3000.

| Service | Port | Role |
|---|---|---|
| tide-sim | 4100 | Simulated TideCloak: sign-in, roles/groups, quorum change requests, 5 ORK nodes (threshold 3) |
| backend | 4000 | Express + SQLite: classes, exam slots, ciphertext, signed policies, exam-time gate, audit log |
| web | 3000 | Next.js: design system, Teacher / Student / Admin screens; all crypto runs in the browser |

The full design is in [docs/SPEC.md](docs/SPEC.md). The design system is in [web/docs/design-system.md](web/docs/design-system.md) and at http://localhost:3000/design-system.

Checks:

```bash
cd tide-sim && npm run smoke        # quorum, ORK release/refusal, attestations (needs tide-sim running)
cd web && npm run shamir-check      # any 3 of 5 shares rebuild the key, 2 do not
```

## Moving to real TideCloak

Each simulated part maps to a real TideCloak feature (planned with Tide's MCP, scenario `relationship-attestation`):

| Simulated (`tide-sim`) | Real TideCloak |
|---|---|
| `/login` persona token | Tide sign-in (`@tidecloak/nextjs`, DPoP-bound JWT) |
| Change requests + 3 approvals | IGA change requests, approved in the Tide enclave by `tide-realm-admin`s |
| `policy.sign` → signed policy | `PolicySignRequest` for contract `RelationshipAttestation:1` (`subjectType` Group `/class-10a`, `assignmentId` = slot id, `roles` `["_tide_decryptor"]`, expiry = exam end) |
| 5 ORK nodes, threshold 3 | Tide ORK network (VVK never assembled) |
| `doEncrypt` / `doDecrypt` | `IAMService.doEncrypt` / `doDecrypt` with the signed policy, tag = slot id |

The backend and the data model stay as they are. The backend would verify the TideCloak JWT and DPoP proof instead of the `tide-sim` key.

## Demo script

1. Sign in as **admin.an**. Under **Exams**, create a final exam for 10A starting in about 5 minutes, then click **Prepare policies**.
2. In **Approvals**, approve both policies as An, then use the **Sign in as** buttons to approve as Binh and Chi (3/3 each).
3. Sign in as **teacher.lan**. Write the paper, click **Encrypt & seal**, and watch the nodes attest.
4. Sign in as **student.minh**. **Open exam** is refused before the start time and works at the start time.
5. Sign in as **student.khoa** (10B). The 10A exam does not appear for this student.
6. Sign in as **admin.dung**. Under **Exams → Admin access**, **Try to open** shows only the ciphertext. **Forged policy test** shows all 5 nodes refusing. **Request access** creates change requests that need 3 admins.
