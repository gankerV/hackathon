import { Seal } from "@/components/ui";
import type { ExamPaper } from "@/lib/paper";
import styles from "./ExamSheet.module.css";

export function ExamSheet({ paper }: { paper: ExamPaper }) {
  return (
    <article className={styles.sheet} aria-label="Exam paper">
      <header className={styles.head}>
        <div>
          <h2 className={styles.title}>{paper.title}</h2>
          {paper.instructions ? <p className={styles.instructions}>{paper.instructions}</p> : null}
        </div>
        <Seal label="Opened" size={80} state="open" />
      </header>
      <ol className={styles.questions}>
        {paper.questions.map((question, index) => (
          <li key={index} className={styles.question}>
            <span className={styles.number}>{index + 1}</span>
            <p>{question}</p>
          </li>
        ))}
      </ol>
    </article>
  );
}
