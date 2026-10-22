"use client";

import type { ReactNode } from "react";
import { useRef } from "react";
import styles from "./Tabs.module.css";

type Tab = { id: string; label: ReactNode; count?: number };

export function Tabs({ tabs, active, onChange, label }: { tabs: Tab[]; active: string; onChange: (id: string) => void; label: string }) {
  const list = useRef<HTMLDivElement>(null);

  function moveFocus(index: number) {
    const next = (index + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    const buttons = list.current?.querySelectorAll<HTMLButtonElement>("[role=tab]");
    buttons?.[next]?.focus();
  }

  return (
    <div className={styles.list} role="tablist" aria-label={label} ref={list}>
      {tabs.map((tab, index) => {
        const selected = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            id={`tab-${tab.id}`}
            aria-selected={selected}
            aria-controls={`panel-${tab.id}`}
            tabIndex={selected ? 0 : -1}
            className={[styles.tab, selected ? styles.active : ""].join(" ")}
            onClick={() => onChange(tab.id)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") moveFocus(index + 1);
              if (event.key === "ArrowLeft") moveFocus(index - 1);
            }}
          >
            {tab.label}
            {tab.count ? <span className={styles.count}>{tab.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <div role="tabpanel" id={`panel-${id}`} aria-labelledby={`tab-${id}`} className={styles.panel}>
      {children}
    </div>
  );
}
