import type { ReactNode } from "react";
import { Icon } from "./Icon";
import styles from "./Stepper.module.css";

export type StepState = "todo" | "active" | "done" | "failed";
export type Step = { id: string; label: ReactNode; detail?: ReactNode; state: StepState };

export function Stepper({ steps, label }: { steps: Step[]; label: string }) {
  return (
    <ol className={styles.steps} aria-label={label}>
      {steps.map((step, index) => (
        <li key={step.id} className={[styles.step, styles[step.state]].join(" ")} aria-current={step.state === "active" ? "step" : undefined}>
          <span className={styles.marker} aria-hidden>
            {step.state === "done" ? <Icon name="check" size={14} /> : step.state === "failed" ? <Icon name="cross" size={14} /> : index + 1}
          </span>
          <span className={styles.text}>
            <span className={styles.label}>{step.label}</span>
            {step.detail ? <span className={styles.detail}>{step.detail}</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

export function Progress({ value, max, label, tone = "accent" }: { value: number; max: number; label: string; tone?: "accent" | "ok" }) {
  const ratio = Math.min(1, max === 0 ? 0 : value / max);
  return (
    <div className={styles.progress} role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value}>
      <span className={[styles.fill, styles[tone]].join(" ")} style={{ width: `${ratio * 100}%` }} />
    </div>
  );
}
