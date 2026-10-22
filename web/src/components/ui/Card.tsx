import type { HTMLAttributes, ReactNode } from "react";
import styles from "./Card.module.css";

type Props = Omit<HTMLAttributes<HTMLElement>, "title"> & {
  tone?: "plain" | "paper" | "sunken";
  title?: ReactNode;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  as?: "section" | "article" | "div";
};

export function Card({ tone = "plain", title, eyebrow, actions, as = "section", className, children, ...rest }: Props) {
  const Tag = as;
  return (
    <Tag className={[styles.card, styles[tone], className ?? ""].join(" ")} {...rest}>
      {title || eyebrow || actions ? (
        <header className={styles.head}>
          <div className={styles.titles}>
            {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
            {title ? <h3 className={styles.title}>{title}</h3> : null}
          </div>
          {actions ? <div className={styles.actions}>{actions}</div> : null}
        </header>
      ) : null}
      {children}
    </Tag>
  );
}
