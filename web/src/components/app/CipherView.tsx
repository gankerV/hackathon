import type { StoredExam } from "@/lib/api";
import styles from "./CipherView.module.css";

function countBytes(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function CipherView({ exam }: { exam: StoredExam }) {
  const { bundle } = exam;
  return (
    <div className={styles.view}>
      <div className={styles.head}>
        <span className={styles.title}>Sealed exam paper</span>
        <span className={styles.meta}>AES-GCM-256 · {countBytes(bundle.ciphertext)} bytes</span>
      </div>
      <pre className={styles.cipher}>{bundle.ciphertext}</pre>
      <dl className={styles.rows}>
        <dt>IV</dt>
        <dd>{bundle.iv}</dd>
        <dt>Digest</dt>
        <dd>{exam.digest}</dd>
      </dl>
    </div>
  );
}
