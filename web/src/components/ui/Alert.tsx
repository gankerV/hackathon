import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import styles from "./Alert.module.css";

type Tone = "info" | "ok" | "warn" | "danger" | "refused";

const icons: Record<Tone, IconName> = { info: "eye", ok: "check", warn: "warn", danger: "warn", refused: "shield" };

export function Alert({ tone = "info", title, children, action }: { tone?: Tone; title?: ReactNode; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className={[styles.alert, styles[tone]].join(" ")} role={tone === "danger" || tone === "refused" ? "alert" : "status"}>
      <span className={styles.icon}>
        <Icon name={icons[tone]} size={18} />
      </span>
      <div className={styles.body}>
        {title ? <strong className={styles.title}>{title}</strong> : null}
        {children ? <div className={styles.text}>{children}</div> : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
