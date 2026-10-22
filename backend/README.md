# Exam Vault backend

Express + `node:sqlite` service on port 4000. It stores encrypted exam bundles, quorum-signed policies, exam slots and a hash-chained audit log. It gates exam release by the server clock.

## Run

```bash
npm install
npm run dev
```

| Env | Default |
|---|---|
| `PORT` | `4000` |
| `TIDE_URL` | `http://localhost:4100` |
| `WEB_ORIGIN` | `http://localhost:3000` |
| `DB_PATH` | `data/exam-vault.db` |

## Endpoints

Every `/api` route except `/api/time` needs `Authorization: Bearer <tide-sim JWT>`.

| Method | Path | Who | Behaviour |
|---|---|---|---|
| GET | /api/time | none | `{ now }` |
| GET | /api/me | any | token claims |
| GET | /api/classes | any | list of classes |
| POST | /api/classes | admin | `{name, groupPath}` → 201, 409 if it exists |
| GET | /api/slots | any | admin: all, teacher: own, student: own class groups. Adds `status`, `hasExam`, `policies: {teacher, class}` |
| POST | /api/slots | admin | `{classId, title, kind, startsAt, endsAt, teacher}`. One midterm and one final per class, else 409 |
| POST | /api/policies | admin | `{slotId, audience, signedPolicy}`. Checks the network signature, `assignmentId === slotId` and the audience subject. 201 new, 200 already stored |
| GET | /api/policies/mine?slotId= | any | the signed policy the caller can use, else 404 |
| PUT | /api/exams/:slotId | slot teacher | `{bundle, digest, attestations}`. Needs a matching digest and 3+ valid attestations from distinct nodes. 423 once the slot starts |
| GET | /api/exams/:slotId | gated | teacher: always. Student: 425 before start, 410 after end. Admin: 403 unless an admin policy names them |
| POST | /api/audit | any | client event `{action, target, detail}` |
| GET | /api/audit | admin | `{ entries (newest first), chainValid }` |

## What the backend can and cannot do

The backend can:
- check JWTs against tide-sim `/jwks`, and policy and attestation signatures against the network key from `/network`
- check that an uploaded bundle matches its digest and carries at least 3 ORK attestations for this teacher and slot
- refuse to hand out ciphertext before the exam starts or after it ends, and refuse admins who have no quorum-approved policy
- record every action in an append-only, hash-chained audit log

The backend cannot:
- read an exam. It never sees plaintext, data keys or key shares. Shares are wrapped to the ORK nodes and only the nodes can unwrap them
- change an exam without detection. The web client checks the digest and the attestations before it shows anything
- grant access by itself. A policy is valid only if the Tide network signed it after 3 admins approved it

## Testing without tide-sim

`scripts/fake-tide.ts` serves `/jwks`, `/network`, `/login`, `/sign-policy` and `/attest` with throwaway keys. `scripts/smoke.ts` runs the full flow against it.

```bash
FAKE_TIDE_PORT=4199 npm run fake-tide
PORT=4010 TIDE_URL=http://localhost:4199 DB_PATH=/tmp/smoke.db npm run start
BACKEND_URL=http://localhost:4010 FAKE_TIDE_URL=http://localhost:4199 npm run smoke
```
