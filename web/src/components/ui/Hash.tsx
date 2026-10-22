import styles from "./Hash.module.css";

export function Hash({ value, head = 10, tail = 6, label }: { value: string; head?: number; tail?: number; label?: string }) {
  const short = value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
  return (
    <code className={styles.hash} title={value} aria-label={label ? `${label}: ${value}` : undefined}>
      {short}
    </code>
  );
}
