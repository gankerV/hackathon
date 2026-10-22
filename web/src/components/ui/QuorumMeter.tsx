import { Seal } from "./Seal";
import styles from "./QuorumMeter.module.css";

export type Approval = { username: string; at: string };

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function QuorumMeter({ approvals, threshold = 3, status = "PENDING", names = {}, compact = false }: { approvals: Approval[]; threshold?: number; status?: "PENDING" | "COMMITTED" | "REJECTED"; names?: Record<string, string>; compact?: boolean }) {
  const count = approvals.length;
  const slots = Array.from({ length: Math.max(threshold, count) }, (_, index) => approvals[index]);
  return (
    <div className={[styles.meter, compact ? styles.compact : "", styles[status.toLowerCase()]].join(" ")}>
      <div className={styles.score} aria-label={`${count} of ${threshold} admin approvals`}>
        <span className={styles.count}>{count}</span>
        <span className={styles.of}>/{threshold}</span>
        <span className={styles.caption}>{status === "COMMITTED" ? "quorum reached" : status === "REJECTED" ? "rejected" : "admin approvals"}</span>
      </div>
      <ol className={styles.lines}>
        {slots.map((approval, index) => (
          <li key={index} className={[styles.line, approval ? styles.signed : ""].join(" ")}>
            {approval ? (
              <>
                <span className={styles.signature}>{names[approval.username] ?? approval.username}</span>
                <span className={styles.meta}>
                  {approval.username} · {formatTime(approval.at)}
                </span>
              </>
            ) : (
              <span className={styles.awaiting}>Awaiting admin {index + 1}</span>
            )}
          </li>
        ))}
      </ol>
      {status === "COMMITTED" && !compact ? (
        <div className={styles.stamp}>
          <Seal label="Signed" sub={`${threshold} OF ${threshold}`} size={84} />
        </div>
      ) : null}
    </div>
  );
}
