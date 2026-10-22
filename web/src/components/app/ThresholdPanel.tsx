import type { ReactNode } from "react";
import { Card, NodeRing, Stepper } from "@/components/ui";
import type { NodeView, Step } from "@/components/ui";
import styles from "./ThresholdPanel.module.css";

export function ThresholdPanel({ title, eyebrow, nodes, steps, okLabel, centerTitle, centerNote, children }: { title: ReactNode; eyebrow?: ReactNode; nodes: NodeView[]; steps: Step[]; okLabel?: string; centerTitle?: ReactNode; centerNote?: ReactNode; children?: ReactNode }) {
  return (
    <Card title={title} eyebrow={eyebrow} className={styles.panel}>
      <div className={styles.grid}>
        <NodeRing nodes={nodes} threshold={3} okLabel={okLabel} centerTitle={centerTitle} centerNote={centerNote} />
        <div className={styles.steps}>
          <Stepper steps={steps} label="Progress" />
        </div>
      </div>
      {children}
    </Card>
  );
}
