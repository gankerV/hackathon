"use client";

import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";
import styles from "./PersonaSwitcher.module.css";

export type Persona = { username: string; name: string; roles: string[]; groups: string[] };

export function mainRole(roles: string[]) {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("teacher")) return "teacher";
  if (roles.includes("student")) return "student";
  return roles[0] ?? "user";
}

export function PersonaSwitcher({ current, personas, onPick, onSignOut, busy }: { current?: Persona | null; personas: Persona[]; onPick: (username: string) => void; onSignOut?: () => void; busy?: string | null }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (box.current && !box.current.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  const groups = ["admin", "teacher", "student"].map((role) => ({ role, people: personas.filter((persona) => mainRole(persona.roles) === role) }));

  return (
    <div className={styles.box} ref={box}>
      <button type="button" className={styles.trigger} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {current ? <Avatar name={current.name} role={mainRole(current.roles)} size="sm" /> : <Icon name="users" />}
        <span className={styles.who}>
          <span className={styles.name}>{current ? current.name : "Choose a persona"}</span>
          {current ? <span className={styles.role}>{mainRole(current.roles)}</span> : null}
        </span>
        <span className={styles.chevron} aria-hidden />
      </button>
      {open ? (
        <div className={styles.menu} role="menu">
          <p className={styles.note}>Switch persona — simulated Tide sign-in</p>
          {groups.map((group) =>
            group.people.length ? (
              <div key={group.role} className={styles.group}>
                <span className="eyebrow">{group.role}s</span>
                {group.people.map((persona) => {
                  const active = current?.username === persona.username;
                  return (
                    <button
                      key={persona.username}
                      type="button"
                      role="menuitemradio"
                      aria-checked={active}
                      className={[styles.item, active ? styles.active : ""].join(" ")}
                      disabled={busy === persona.username}
                      onClick={() => {
                        setOpen(false);
                        if (!active) onPick(persona.username);
                      }}
                    >
                      <Avatar name={persona.name} role={group.role} size="sm" />
                      <span className={styles.itemText}>
                        <span>{persona.name}</span>
                        <span className={styles.itemMeta}>{persona.groups.join(", ") || persona.username}</span>
                      </span>
                      {active ? <Icon name="check" /> : null}
                    </button>
                  );
                })}
              </div>
            ) : null,
          )}
          {onSignOut && current ? (
            <button type="button" className={styles.signout} onClick={() => { setOpen(false); onSignOut(); }}>
              <Icon name="power" /> Sign out
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
