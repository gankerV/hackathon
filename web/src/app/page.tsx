"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { homeFor } from "@/components/app/Header";
import { Alert, Avatar, mainRole } from "@/components/ui";
import type { Persona } from "@/components/ui";
import { errorText } from "@/lib/format";
import { getDemoUsers, useTide } from "@/lib/tide";
import styles from "./page.module.css";

const roleTitles: Record<string, string> = { admin: "Admins", teacher: "Teacher", student: "Students" };

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
      <header className={styles.hero}>
        <h1 className={styles.headline}>
          Exam papers stay sealed until the bell. <em>Even from admins.</em>
        </h1>
        <p className={styles.lede}>Only the class can open a paper, only during the exam, and only after 3 admins agree.</p>
      </header>
      {problem ? <Alert tone="danger" title={problem} /> : null}
      <section className={styles.roleGrid} aria-label="Sign in with Tide">
        {groups.map((group) => (
          <div key={group.role} className={styles.roleColumn}>
            <h2 className={styles.roleName}>{roleTitles[group.role]}</h2>
            {personas === null ? <div className={styles.skeleton} /> : null}
            {group.people.map((persona) => {
              const current = user?.username === persona.username;
              return (
                <button key={persona.username} type="button" className={[styles.persona, current ? styles.personaCurrent : ""].join(" ")} onClick={() => choose(persona)} disabled={busy !== null}>
                  <Avatar name={persona.name} role={group.role} />
                  <span className={styles.personaText}>
                    <strong>{persona.name}</strong>
                    <span className="mono">{persona.groups[0] ?? persona.username}</span>
                  </span>
                  <span className={styles.personaAction}>{busy === persona.username ? "Signing in…" : "Sign in"}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>
    </div>
  );
}
