import type { ReactNode } from "react";
import { Badge } from "@/components/ui";
import type { ClassRoom, Slot } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import styles from "./SlotList.module.css";

export function statusBadge(status: Slot["status"]) {
  if (status === "open") return <Badge tone="ok" dot>Open now</Badge>;
  if (status === "closed") return <Badge tone="neutral">Closed</Badge>;
  return <Badge tone="info">Upcoming</Badge>;
}

export function SlotList({ slots, classes, selected, onSelect, extra }: { slots: Slot[]; classes: ClassRoom[]; selected: string | null; onSelect: (id: string) => void; extra?: (slot: Slot) => ReactNode }) {
  return (
    <ul className={styles.list}>
      {slots.map((slot) => {
        const room = classes.find((item) => item.id === slot.classId);
        const active = slot.id === selected;
        return (
          <li key={slot.id}>
            <button type="button" className={[styles.slot, active ? styles.active : ""].join(" ")} onClick={() => onSelect(slot.id)} aria-pressed={active}>
              <span className={styles.top}>
                <span className="eyebrow">
                  {room ? `Class ${room.name}` : slot.classId} · {slot.kind}
                </span>
                {statusBadge(slot.status)}
              </span>
              <span className={styles.title}>{slot.title}</span>
              <span className={styles.when}>
                {formatDateTime(slot.startsAt)} → {new Date(slot.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
              {extra ? <span className={styles.extra}>{extra(slot)}</span> : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
