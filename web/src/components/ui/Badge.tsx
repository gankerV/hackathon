import type { ReactNode } from "react";
import styles from "./Badge.module.css";

type Props = {
  tone?: "neutral" | "accent" | "ok" | "warn" | "danger" | "info";
  dot?: boolean;
  children: ReactNode;
  title?: string;
};

export function Badge({ tone = "neutral", dot = false, children, title }: Props) {
  return (
    <span className={[styles.badge, styles[tone]].join(" ")} title={title}>
      {dot ? <span className={styles.dot} aria-hidden /> : null}
      {children}
    </span>
  );
}
