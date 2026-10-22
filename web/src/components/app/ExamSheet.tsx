import { Seal } from "@/components/ui";
import type { ExamPaper } from "@/lib/paper";
import styles from "./ExamSheet.module.css";

export function ExamSheet({ paper, slotTitle, className, note }: { paper: ExamPaper; slotTitle?: string; className?: string; note?: string }) {
  return (
    <article className={styles.sheet} aria-label="Exam paper">
      <header className={styles.head}>
        <div>
          <span className="eyebrow">{[slotTitle, className].filter(Boolean).join(" · ") || "Exam paper"}</span>
          <h2 className={styles.title}>{paper.title}</h2>
          {paper.instructions ? <p className={styles.instructions}>{paper.instructions}</p> : null}
        </div>
        <Seal label="Opened" sub="3 OF 5 NODES" size={88} state="open" />
      </header>
      <ol className={styles.questions}>
        {paper.questions.map((question, index) => (
          <li key={index} className={styles.question}>
            <span className={styles.number}>{index + 1}</span>
            <p>{question}</p>
          </li>
        ))}
      </ol>
      <footer className={styles.foot}>
        <span>{note ?? "Read-only copy decrypted in this browser. The server never saw this text."}</span>
        {paper.sealedAt ? <span className="mono">sealed {new Date(paper.sealedAt).toLocaleString()}</span> : null}
      </footer>
    </article>
  );
}
