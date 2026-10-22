import styles from "./Countdown.module.css";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function splitDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return { days: Math.floor(total / 86400), hours: Math.floor((total % 86400) / 3600), minutes: Math.floor((total % 3600) / 60), seconds: total % 60 };
}

export function Countdown({ target, now, label = "Opens in", doneLabel = "Open now", size = "md" }: { target: number; now: number; label?: string; doneLabel?: string; size?: "md" | "lg" }) {
  const left = target - now;
  if (left <= 0) {
    return (
      <div className={[styles.countdown, styles[size], styles.done].join(" ")} role="timer" aria-live="polite">
        <span className="eyebrow">{doneLabel}</span>
      </div>
    );
  }
  const { days, hours, minutes, seconds } = splitDuration(left);
  const parts = days > 0 ? [[days, "d"], [hours, "h"], [minutes, "m"], [seconds, "s"]] : [[hours, "h"], [minutes, "m"], [seconds, "s"]];
  return (
    <div className={[styles.countdown, styles[size]].join(" ")} role="timer" aria-label={`${label} ${days} days ${hours} hours ${minutes} minutes ${seconds} seconds`}>
      <span className="eyebrow">{label}</span>
      <span className={styles.digits} aria-hidden>
        {parts.map(([value, unit], index) => (
          <span key={String(unit)} className={styles.part}>
            {index > 0 ? <span className={styles.sep}>:</span> : null}
            <span className={styles.value}>{pad(Number(value))}</span>
            <span className={styles.unit}>{unit}</span>
          </span>
        ))}
      </span>
    </div>
  );
}
