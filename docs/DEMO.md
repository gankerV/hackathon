# Exam Vault: demo and notes

## Demo script

1. Sign in as **admin.an**. Under **Exams**, create a final exam for 10A starting in about 5 minutes, then click **Prepare policies**.
2. In **Approvals**, approve both policies as An, then use the **Sign in as** buttons to approve as Binh and Chi (3/3 each).
3. Sign in as **teacher.lan**. Write the paper, click **Encrypt & seal**, and watch the nodes attest.
4. Sign in as **student.minh**. **Open exam** is refused before the start time and works at the start time.
5. Sign in as **student.khoa** (10B). The 10A exam does not appear for this student.
6. Sign in as **admin.dung**. Under **Exams → Admin access**, **Try to open** shows only the ciphertext. **Forged policy test** shows all 5 nodes refusing. **Request access** creates change requests that need 3 admins.

## Services

Start everything with `./dev.sh`, or run each service with `npm install && npm run dev` inside its folder.

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
