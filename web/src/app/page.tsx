"use client";

import Link from "next/link";
import { homeFor } from "@/components/app/Header";
import { useTide } from "@/lib/tide";
import styles from "./page.module.css";

export default function HomePage() {
  const { user } = useTide();

  return (
    <div className={styles.home}>
      <h1 className={styles.headline}>
        Exam papers stay sealed until the bell. <em>Even from admins.</em>
      </h1>
      <p className={styles.lede}>Only the class can open a paper, only during the exam, and only after 3 admins agree.</p>
      {user ? (
        <Link href={homeFor(user.roles)} className={styles.cta}>
          Continue as {user.name}
        </Link>
      ) : (
        <Link href="/login" className={styles.cta}>
          Sign in with Tide
        </Link>
      )}
    </div>
  );
}
