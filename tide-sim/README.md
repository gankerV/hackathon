# tide-sim

A local stand-in for TideCloak used by the Exam Vault prototype. It runs on port 4100 and keeps the same model the real Tide stack uses, so the backend and web can later point at a real TideCloak without changing their data shapes.

## What it simulates

| tide-sim | Real TideCloak |
|---|---|
| `POST /login` issues an ES256 JWT with `realm_access.roles`, `groups`, `tideuserkey`; public key at `/jwks` | Passwordless Tide sign-in; the realm issues the token ("doken") |
| `/change-requests` with a 3-admin quorum (`approve` / `reject`) | IGA change requests: role, group and policy changes are drafted and only committed after enough admins approve |
| `policy.sign` commits a `RelationshipAttestation:1` policy signed with the Ed25519 network key | Forseti policy contract signed by the Tide network (vendor key) after quorum approval |
| 5 ORK nodes, threshold 3, each with its own P-256 ECDH key (`/ork/:node/*`) | Threshold ORK nodes; no single node holds the full key, and each node checks the policy and token independently |
| `authorize-encrypt` / `release-share` checks (online, token, signature, time window, `assignmentId` tag, subject, `_tide_encryptor` / `_tide_decryptor`) | `doEncrypt` / `doDecrypt` authorization performed by the ORKs |

The nodes share the network key for attestations, which the real network does with a threshold signature.

## Run

```bash
npm install
npm run dev
```

`npm start` runs without watch mode. Keys, users, change requests and node flags are saved in `data/state.json`, which is created on first start. Delete it to reseed.

## Check

```bash
npm run check
npm run smoke
```

`npm run smoke` needs the server running. It drives a full policy quorum, wraps a share to node 1 the way the browser does, and checks that a student in `/class-10a` gets the share back and a student in `/class-10b` is refused.
