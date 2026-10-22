import styles from "./Seal.module.css";

function edge(points: number, outer: number, inner: number) {
  const parts: string[] = [];
  for (let index = 0; index < points * 2; index += 1) {
    const radius = index % 2 === 0 ? outer : inner;
    const angle = (Math.PI * index) / points;
    parts.push(`${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return parts.join(" ");
}

const outline = edge(18, 48, 44);

export function Seal({ label = "Sealed", sub, size = 96, state = "sealed" }: { label?: string; sub?: string; size?: number; state?: "sealed" | "open" | "broken" }) {
  return (
    <span className={[styles.seal, styles[state]].join(" ")} style={{ width: size, height: size }} aria-label={`${label}${sub ? ` ${sub}` : ""}`} role="img">
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden>
        <polygon points={outline} className={styles.wax} />
        <circle cx="50" cy="50" r="34" className={styles.ring} />
        <circle cx="50" cy="50" r="29" className={styles.ringInner} />
        <text x="50" y={sub ? 48 : 53} textAnchor="middle" className={styles.label}>
          {label}
        </text>
        {sub ? (
          <text x="50" y="62" textAnchor="middle" className={styles.sub}>
            {sub}
          </text>
        ) : null}
      </svg>
    </span>
  );
}
