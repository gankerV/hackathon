"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { Alert, Avatar, Badge, Button, Card, Hash, Input, Select, Table, mainRole } from "@/components/ui";
import { errorText } from "@/lib/format";
import { ADMIN_THRESHOLD } from "@/lib/tide";
import type { DirectoryUser } from "@/lib/tide";
import { proposeChange } from "./policy";
import styles from "./Admin.module.css";
import type { AdminData } from "./useAdminData";

type Action = "user.addRole" | "user.removeRole" | "user.addGroup" | "user.removeGroup";

const roleChoices = ["admin", "teacher", "student", "_tide_encryptor", "_tide_decryptor"];

export function UsersTab({ data, onProposed }: { data: AdminData; onProposed: () => void }) {
  const [action, setAction] = useState<Action>("user.addRole");
  const [username, setUsername] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "danger"; title: string; text?: string } | null>(null);
  const isRole = action.endsWith("Role");

  async function propose(event: FormEvent) {
    event.preventDefault();
    if (!username || !value.trim()) return;
    setBusy(true);
    setNotice(null);
    try {
      const request = await proposeChange(action, isRole ? { username, role: value.trim() } : { username, group: value.trim() });
      setNotice({ tone: "ok", title: `Request ${request.id} proposed`, text: `It needs ${ADMIN_THRESHOLD} admin approvals before the network applies it.` });
      await data.loadTide();
    } catch (error) {
      setNotice({ tone: "danger", title: "Could not propose the change", text: errorText(error) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.split}>
      <Table<DirectoryUser>
        rowKey={(row) => row.username}
        rows={data.users}
        empty={data.tideError ?? "Loading users…"}
        columns={[
          {
            key: "who",
            label: "User",
            render: (row) => (
              <span className={styles.who}>
                <Avatar name={row.name} role={mainRole(row.roles)} size="sm" />
                <span>
                  {row.name}
                  <br />
                  <span className="mono muted">{row.username}</span>
                </span>
              </span>
            ),
          },
          { key: "roles", label: "Roles", render: (row) => <span className={styles.badges}>{row.roles.map((role) => <Badge key={role} tone={role.startsWith("_tide") ? "accent" : "neutral"}>{role}</Badge>)}</span> },
          { key: "groups", label: "Groups", render: (row) => <span className="mono">{row.groups.join(", ") || "—"}</span> },
          { key: "key", label: "Tide user key", render: (row) => <Hash value={row.tideuserkey} head={8} tail={4} /> },
        ]}
      />
      <Card title="Propose a change" eyebrow="Change request">
        <form className="stack" onSubmit={propose}>
          <Select label="Change" value={action} onChange={(event) => { setAction(event.target.value as Action); setValue(""); }}>
            <option value="user.addRole">Grant a role</option>
            <option value="user.removeRole">Remove a role</option>
            <option value="user.addGroup">Add to a group</option>
            <option value="user.removeGroup">Remove from a group</option>
          </Select>
          <Select label="User" value={username} onChange={(event) => setUsername(event.target.value)} required>
            <option value="">Choose a user</option>
            {data.users.map((item) => (
              <option key={item.username} value={item.username}>
                {item.name} ({item.username})
              </option>
            ))}
          </Select>
          <Input label={isRole ? "Role" : "Group path"} value={value} onChange={(event) => setValue(event.target.value)} list={isRole ? "role-choices" : "group-choices"} placeholder={isRole ? "_tide_decryptor" : "/class-10a"} mono required />
          <datalist id="role-choices">
            {roleChoices.map((role) => <option key={role} value={role} />)}
          </datalist>
          <datalist id="group-choices">
            {data.classes.map((room) => <option key={room.id} value={room.groupPath} />)}
            <option value="/teachers" />
          </datalist>
          <Button type="submit" busy={busy} disabled={!username || !value.trim()}>
            Propose for quorum
          </Button>
          <p className="muted" style={{ fontSize: "var(--text-xs)" }}>
            Proposing does not change anything. The change applies only after {ADMIN_THRESHOLD} admins approve it.
          </p>
        </form>
        {notice ? (
          <Alert tone={notice.tone} title={notice.title} action={notice.tone === "ok" ? <Button size="sm" variant="secondary" onClick={onProposed}>Go to approvals</Button> : undefined}>
            {notice.text}
          </Alert>
        ) : null}
      </Card>
    </div>
  );
}
