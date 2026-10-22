import type { ReactNode } from "react";
import { Card, NodeRing } from "@/components/ui";
import type { NodeView } from "@/components/ui";

export function RingCard({ title, nodes, okLabel, caption, children }: { title: ReactNode; nodes: NodeView[]; okLabel: string; caption: ReactNode; children?: ReactNode }) {
  return (
    <Card title={title}>
      <NodeRing nodes={nodes} threshold={3} okLabel={okLabel} showList={false} centerTitle={caption} />
      {children}
    </Card>
  );
}
