import type { ButtonHTMLAttributes, ReactNode } from "react";
import styles from "./Button.module.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  busy?: boolean;
  icon?: ReactNode;
};

export function Button({ variant = "primary", size = "md", busy = false, icon, className, children, disabled, ...rest }: Props) {
  const names = [styles.button, styles[variant], styles[size], busy ? styles.busy : "", className ?? ""].join(" ");
  return (
    <button className={names} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {busy ? <span className={styles.spinner} aria-hidden /> : icon ? <span className={styles.icon}>{icon}</span> : null}
      <span>{children}</span>
    </button>
  );
}
