# Exam Vault

[![Built with TideCloak](https://tide.org/badges/built-with-tidecloak.svg)](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked)

## Project overview

Exam papers locked in the teacher's browser. Only the class can open them, only at exam time. No admin or server can read them.

Built with [TideCloak](https://tide.org/tidecloak?utm_source=github&utm_medium=readme&utm_campaign=unlocked). [Watch the demo](demo/exam-vault-demo.mp4)

### 1. Vision & originality

The paper is protected, not the server. A teacher locks it in their own browser. It opens only for the right class, at exam time, under a rule that three admins signed.

### 2. Trust constraint insight

Papers leak through whoever holds the keys: an IT admin, a shared drive, a hacked server. Schools fall back on USB sticks and locked cabinets. Remove that trust problem and papers can be prepared early and stay digital.

### 3. Value & impact

- Teachers prepare early without fear of leaks.
- Students get a fair exam.
- Schools can prove, with an audit log, that no admin opened a paper.

### 4. Why TideCloak matters

No one holds the key. It is split across many nodes. Each node checks the student's class, role and a policy that three admins signed. Admins cannot read papers, and every access change needs three admins. This prototype simulates TideCloak (`tide-sim`).

### 5. Prototype & storytelling

Look for three moments:

1. A teacher locks a paper.
2. A student is refused before the start time, then opens it at the start time.
3. An admin sees only scrambled text.

## Setup

Needs Node 24.

```bash
./dev.sh
```

Open http://localhost:3000. Demo steps: [docs/DEMO.md](docs/DEMO.md).
