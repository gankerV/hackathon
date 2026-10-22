"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { homeFor } from "@/components/app/Header";
import { Alert, Avatar, Button, Icon, Seal, mainRole } from "@/components/ui";
import type { Persona } from "@/components/ui";
import { errorText } from "@/lib/format";
import { TIDE_URL, getDemoUsers, useTide } from "@/lib/tide";
import styles from "./page.module.css";

const guarantees = [
  { who: "The school's IT admin", what: "Can manage the database and still sees only ciphertext. Opening a paper needs a policy signed by three admins." },
  { who: "The backend server", what: "Stores sealed papers and the exam clock. It never holds a key share, so a breach leaks nothing readable." },
  { who: "Any one ORK node", what: "Holds one share of each key. Two nodes colluding still fall short of the 3-of-5 threshold." },
];

const flow = [
  { step: "Seal", text: "The teacher writes the paper and encrypts it in the browser. The key is split across 5 ORK nodes." },
  { step: "Sign", text: "Three admins approve a policy: who may open which paper, from when, until when." },
  { step: "Release", text: "At the bell, each node checks the policy and the student's token before releasing its share." },
  { step: "Open", text: "Any 3 shares rebuild the key in the student's browser. The paper opens, read-only." },
];

const roleCopy: Record<string, string> = {
  admin: "Govern access. No single admin can grant it.",
  teacher: "Write and seal exam papers.",
  student: "Open the paper when the exam starts.",
};

export default function HomePage() {
  const { user, signIn } = useTide();
  const router = useRouter();
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getDemoUsers()
      .then(setPersonas)
      .catch((error) => {
        setPersonas([]);
        setProblem(errorText(error));
      });
  }, []);

  async function choose(persona: Persona) {
    setBusy(persona.username);
    setProblem(null);
    try {
      await signIn(persona.username);
      router.push(homeFor(persona.roles));
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(null);
    }
  }

  const groups = ["admin", "teacher", "student"].map((role) => ({ role, people: (personas ?? []).filter((persona) => mainRole(persona.roles) === role) }));

  return (
    <div className={styles.home}>
      <section className={styles.hero}>
        <div className={styles.heroText}>
          <span className="eyebrow">Exam Vault · TideCloak UNLOCKED</span>
          <h1 className={styles.headline}>
            The paper stays sealed until the bell. <em>Even from us.</em>
          </h1>
          <p className={styles.lede}>
            Leaked exam papers are an insider problem: whoever runs the server can read the file. Exam Vault encrypts every paper in the teacher&apos;s browser and splits its key across a decentralized network. Only the class can open it, only during the exam, and only after three admins agree.
          </p>
          <div className="row">
            <a href="#personas" className={styles.cta}>
              Sign in with Tide <Icon name="arrow" />
            </a>
            <span className="muted">Simulated sign-in, no passwords</span>
          </div>
        </div>
        <div className={styles.heroArt} aria-hidden>
          <div className={styles.envelope}>
            <span className={styles.envelopeLine} />
            <span className={styles.envelopeLine} />
            <span className={styles.envelopeLineShort} />
            <code className={styles.cipher}>9f3a c07e 51b2 e8d4 77aa 02f1 c9e3 4b60 d1 …</code>
            <div className={styles.envelopeSeal}>
              <Seal label="Sealed" sub="3 OF 5" size={104} />
            </div>
          </div>
        </div>
      </section>

      <section className={styles.flow} aria-label="How it works">
        {flow.map((item, index) => (
          <div key={item.step} className={styles.flowItem}>
            <span className={styles.flowIndex}>{String(index + 1).padStart(2, "0")}</span>
            <h3>{item.step}</h3>
            <p className="muted">{item.text}</p>
          </div>
        ))}
      </section>

      <section className={styles.trust}>
        <div className={styles.trustIntro}>
          <span className="eyebrow">Who cannot read the paper</span>
          <h2>Trust moves from people to math.</h2>
          <p className="muted">With TideCloak the key never exists in one place. Not on the server, not with an admin, not in a single node. Authority is a signed policy that the network itself enforces.</p>
        </div>
        <ul className={styles.trustList}>
          {guarantees.map((item) => (
            <li key={item.who}>
              <Icon name="shield" size={20} />
              <div>
                <strong>{item.who}</strong>
                <p className="muted">{item.what}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section id="personas" className={styles.personas}>
        <div className={styles.personasHead}>
          <span className="eyebrow">Demo personas</span>
          <h2>Sign in with Tide — simulated</h2>
          <p className="muted">Each persona gets a signed token from the simulated TideCloak at <code>{TIDE_URL}</code>. Switch any time from the header to walk through a quorum.</p>
        </div>
        {problem ? (
          <Alert tone="danger" title="The Tide network is not answering">
            {problem} Start it with <code>npm run dev</code> in <code>tide-sim/</code>.
          </Alert>
        ) : null}
        <div className={styles.roleGrid}>
          {groups.map((group) => (
            <div key={group.role} className={styles.roleColumn}>
              <div className={styles.roleHead}>
                <h3 className={styles.roleName}>{group.role}s</h3>
                <p className="muted">{roleCopy[group.role]}</p>
              </div>
              {personas === null ? <div className={styles.skeleton} /> : null}
              {group.people.map((persona) => {
                const current = user?.username === persona.username;
                return (
                  <button key={persona.username} type="button" className={[styles.persona, current ? styles.personaCurrent : ""].join(" ")} onClick={() => choose(persona)} disabled={busy !== null}>
                    <Avatar name={persona.name} role={group.role} />
                    <span className={styles.personaText}>
                      <strong>{persona.name}</strong>
                      <span className="mono">{persona.username}</span>
                      <span className={styles.personaMeta}>{[...persona.groups, ...persona.roles.filter((role) => role.startsWith("_tide"))].join(" · ") || "realm admin"}</span>
                    </span>
                    <span className={styles.personaAction}>{busy === persona.username ? "Signing in…" : current ? "Continue" : "Sign in"}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {user ? (
          <div className="row">
            <Button variant="secondary" onClick={() => router.push(homeFor(user.roles))}>
              Continue as {user.name}
            </Button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
