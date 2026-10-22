"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PersonaSwitcher, mainRole } from "@/components/ui";
import type { Persona } from "@/components/ui";
import { useServerClock } from "@/lib/clock";
import { formatTime } from "@/lib/format";
import { getDemoUsers, useTide } from "@/lib/tide";
import styles from "./Header.module.css";

export function homeFor(roles: string[]) {
  const role = mainRole(roles);
  return role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : role === "student" ? "/student" : "/";
}

export function BrandMark() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <rect x="4" y="3" width="17" height="22" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 9h9M8 13h9M8 17h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="20" cy="20" r="5.5" fill="var(--color-accent)" />
      <path d="M17.8 20.2l1.5 1.5l2.9-3" fill="none" stroke="var(--color-text-on-accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Header() {
  const { user, signIn, signOut } = useTide();
  const router = useRouter();
  const pathname = usePathname();
  const { now, synced } = useServerClock();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    getDemoUsers().then(setPersonas).catch(() => setPersonas([]));
  }, []);

  async function pick(username: string) {
    setBusy(username);
    try {
      const { token } = await signIn(username);
      const persona = personas.find((item) => item.username === username);
      const roles = persona?.roles ?? [];
      const target = homeFor(roles);
      if (token && !pathname.startsWith(target)) router.push(target);
    } finally {
      setBusy(null);
    }
  }

  const role = user ? mainRole(user.roles) : null;
  const link = role === "admin" ? { href: "/admin", label: "Admin" } : role === "teacher" ? { href: "/teacher", label: "Teacher" } : role === "student" ? { href: "/student", label: "Student" } : null;

  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <BrandMark />
          <span className={styles.brandName}>Exam Vault</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          {link ? (
            <Link href={link.href} className={[styles.link, pathname.startsWith(link.href) ? styles.current : ""].join(" ")} aria-current={pathname.startsWith(link.href) ? "page" : undefined}>
              {link.label}
            </Link>
          ) : null}
        </nav>
        <div className={styles.side}>
          <span className={styles.clock} title="Server time from the backend">
            <span className={[styles.clockDot, synced ? styles.synced : ""].join(" ")} aria-hidden />
            <span className="visually-hidden">Server time</span>
            {synced ? formatTime(now) : "--:--:--"}
          </span>
          {user ? (
            <PersonaSwitcher
              current={{ username: user.username, name: user.name, roles: user.roles, groups: user.groups }}
              personas={personas}
              busy={busy}
              onPick={pick}
              onSignOut={() => {
                signOut();
                router.push("/login");
              }}
            />
          ) : (
            <Link href="/login" className={styles.signIn}>
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
