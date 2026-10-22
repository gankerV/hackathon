import type { ReactNode } from "react";
import styles from "./NodeRing.module.css";

export type NodeState = "idle" | "pending" | "ok" | "refused" | "offline";
export type NodeView = { id: number; state: NodeState; detail?: string };

const stateText: Record<NodeState, string> = {
  idle: "Waiting",
  pending: "Checking policy",
  ok: "Agreed",
  refused: "Refused",
  offline: "Offline",
};

const glyphs: Partial<Record<NodeState, string>> = {
  ok: "M-7 0.5l4.5 4.5L7.5-5",
  refused: "M-6-6l12 12M6-6l-12 12",
  offline: "M-7 0h14",
};

function place(index: number, total: number, radius: number) {
  const angle = (-90 + (360 / total) * index) * (Math.PI / 180);
  return { x: 160 + radius * Math.cos(angle), y: 160 + radius * Math.sin(angle) };
}

export function NodeRing({ nodes, threshold, centerTitle, centerNote, okLabel = "Agreed", showList = true, small = false, footer }: { nodes: NodeView[]; threshold: number; centerTitle?: ReactNode; centerNote?: ReactNode; okLabel?: string; showList?: boolean; small?: boolean; footer?: ReactNode }) {
  const okCount = nodes.filter((node) => node.state === "ok").length;
  const reached = okCount >= threshold;
  const anyActive = nodes.some((node) => node.state !== "idle");
  const failed = anyActive && !reached && nodes.every((node) => node.state !== "pending" && node.state !== "idle");
  return (
    <div className={[styles.wrap, small || !showList ? styles.single : "", small ? styles.small : ""].join(" ")}>
      <figure className={styles.figure} aria-label={`${okCount} of ${nodes.length} nodes ${okLabel.toLowerCase()}, ${threshold} needed`}>
        <svg viewBox="0 0 320 320" className={styles.svg} role="img" aria-hidden>
          <circle cx="160" cy="160" r="112" className={styles.orbit} />
          {nodes.map((node, index) => {
            const point = place(index, nodes.length, 112);
            return <line key={`l${node.id}`} x1={point.x} y1={point.y} x2="160" y2="160" className={[styles.link, styles[`link_${node.state}`]].join(" ")} style={{ transitionDelay: `${index * 90}ms` }} />;
          })}
          <g className={[styles.core, reached ? styles.coreDone : failed ? styles.coreFailed : ""].join(" ")}>
            <circle cx="160" cy="160" r="50" className={styles.coreDisc} />
            <circle cx="160" cy="160" r="43" className={styles.coreInner} />
            <text x="160" y="160" className={styles.coreCount} textAnchor="middle" dominantBaseline="central">
              {Math.min(okCount, nodes.length)}/{threshold}
            </text>
            <text x="160" y="190" className={styles.coreCaption} textAnchor="middle">
              {reached ? "threshold met" : "needed"}
            </text>
          </g>
          {nodes.map((node, index) => {
            const point = place(index, nodes.length, 112);
            const glyph = glyphs[node.state];
            return (
              <g key={node.id} transform={`translate(${point.x} ${point.y})`} className={[styles.node, styles[node.state]].join(" ")} style={{ transitionDelay: `${index * 90}ms` }}>
                {node.state === "pending" ? <circle r="34" className={styles.pulse} /> : null}
                <circle r="26" className={styles.nodeDisc} />
                {glyph ? <path d={glyph} className={styles.glyph} /> : <text className={styles.nodeId} textAnchor="middle" dominantBaseline="central">{node.id}</text>}
                <text y="44" className={styles.nodeLabel} textAnchor="middle">
                  ORK {node.id}
                </text>
              </g>
            );
          })}
        </svg>
        {centerTitle || centerNote ? (
          <figcaption className={styles.caption}>
            {centerTitle ? <strong>{centerTitle}</strong> : null}
            {centerNote ? <span>{centerNote}</span> : null}
          </figcaption>
        ) : null}
      </figure>
      {showList ? (
        <ul className={styles.list}>
          {nodes.map((node) => (
            <li key={node.id} className={[styles.item, styles[`item_${node.state}`]].join(" ")}>
              <span className={styles.itemDot} aria-hidden />
              <span className={styles.itemName}>ORK node {node.id}</span>
              <span className={styles.itemState}>{node.state === "ok" ? okLabel : stateText[node.state]}</span>
              {node.detail ? <span className={styles.itemDetail}>{node.detail}</span> : null}
            </li>
          ))}
          {footer ? <li className={styles.footer}>{footer}</li> : null}
        </ul>
      ) : null}
    </div>
  );
}
