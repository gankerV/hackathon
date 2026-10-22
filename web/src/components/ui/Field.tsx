"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { useId } from "react";
import styles from "./Field.module.css";

type Frame = { label: ReactNode; hint?: ReactNode; error?: ReactNode };

function FieldFrame({ id, label, hint, error, children }: Frame & { id: string; children: ReactNode }) {
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <span className={styles.error} id={`${id}-note`}>
          {error}
        </span>
      ) : hint ? (
        <span className={styles.hint} id={`${id}-note`}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export function Input({ label, hint, error, className, mono, ...rest }: Frame & InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <input id={id} aria-invalid={error ? true : undefined} aria-describedby={hint || error ? `${id}-note` : undefined} className={[styles.control, mono ? styles.mono : "", className ?? ""].join(" ")} {...rest} />
    </FieldFrame>
  );
}

export function Textarea({ label, hint, error, className, ...rest }: Frame & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <textarea id={id} aria-invalid={error ? true : undefined} aria-describedby={hint || error ? `${id}-note` : undefined} className={[styles.control, styles.area, className ?? ""].join(" ")} {...rest} />
    </FieldFrame>
  );
}

export function Select({ label, hint, error, className, children, ...rest }: Frame & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <FieldFrame id={id} label={label} hint={hint} error={error}>
      <select id={id} aria-invalid={error ? true : undefined} className={[styles.control, styles.select, className ?? ""].join(" ")} {...rest}>
        {children}
      </select>
    </FieldFrame>
  );
}
