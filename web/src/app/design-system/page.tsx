"use client";

import { useEffect, useState } from "react";
import { ExamSheet } from "@/components/app/ExamSheet";
import { Alert, Avatar, Badge, Button, Card, Countdown, Hash, Icon, Input, NodeRing, PersonaSwitcher, Progress, QuorumMeter, Seal, Select, Stepper, Table, TabPanel, Tabs, Textarea } from "@/components/ui";
import type { NodeView, Persona } from "@/components/ui";
import styles from "./page.module.css";

const colors = [
  ["--color-bg", "Background"],
  ["--color-surface", "Surface"],
  ["--color-surface-sunken", "Sunken"],
  ["--color-border", "Border"],
  ["--color-text", "Ink"],
  ["--color-text-muted", "Ink muted"],
  ["--color-accent", "Wax (accent)"],
  ["--color-accent-soft", "Wax soft"],
  ["--color-ok", "Pine (ok)"],
  ["--color-warn", "Ochre (warn)"],
  ["--color-danger", "Crimson (danger)"],
  ["--color-info", "Slate (info)"],
];

const typeScale = [
  ["--text-4xl", "Display numerals", "mono"],
  ["--text-3xl", "Page title", "serif"],
  ["--text-2xl", "Section title", "serif"],
  ["--text-xl", "Card title", "serif"],
  ["--text-lg", "Subhead", "serif"],
  ["--text-md", "Lead text", "sans"],
  ["--text-base", "Body text", "sans"],
  ["--text-sm", "Secondary text", "sans"],
  ["--text-xs", "Caption and eyebrow", "sans"],
];

const spaces = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-6", "--space-8", "--space-12", "--space-16"];

const personas: Persona[] = [
  { username: "admin.an", name: "An Nguyen", roles: ["admin"], groups: [] },
  { username: "teacher.lan", name: "Lan Vo", roles: ["teacher", "_tide_encryptor", "_tide_decryptor"], groups: ["/teachers"] },
  { username: "student.minh", name: "Minh Ho", roles: ["student", "_tide_decryptor"], groups: ["/class-10a"] },
];

const sampleNodes: NodeView[] = [
  { id: 1, state: "ok", detail: "Share released over the policy" },
  { id: 2, state: "ok", detail: "Share released over the policy" },
  { id: 3, state: "pending" },
  { id: 4, state: "refused", detail: "'/class-10a' group not found in doken." },
  { id: 5, state: "offline", detail: "Node is offline." },
];

const cycle: NodeView["state"][][] = [
  ["idle", "idle", "idle", "idle", "idle"],
  ["pending", "pending", "pending", "pending", "pending"],
  ["ok", "pending", "pending", "offline", "pending"],
  ["ok", "ok", "pending", "offline", "refused"],
  ["ok", "ok", "ok", "offline", "refused"],
];

export default function DesignSystemPage() {
  const [tab, setTab] = useState("one");
  const [frame, setFrame] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [target] = useState(() => Date.now() + 3 * 3600 * 1000 + 125 * 1000);
  const [approvals, setApprovals] = useState(1);

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(Date.now());
      setFrame((value) => (value + 1) % (cycle.length + 2));
    }, 1100);
    return () => clearInterval(timer);
  }, []);

  const step = cycle[Math.min(frame, cycle.length - 1)];
  const liveNodes: NodeView[] = step.map((state, index) => ({ id: index + 1, state }));
  const approvalList = ["admin.an", "admin.binh", "admin.chi"].slice(0, approvals).map((username, index) => ({ username, at: new Date(Date.now() - (3 - index) * 60000).toISOString() }));

  return (
    <div className={`page ${styles.page}`}>
      <header className={styles.head}>
        <span className="eyebrow">Exam Vault design system</span>
        <h1>Sealed paper</h1>
        <p className="muted">Warm paper surfaces, near-black ink and one wax-red accent. Serif for the voice of the exam hall, sans for controls, mono for anything a machine produced: keys, hashes, times. Red means sealed or refused; refusals are a feature, so they get the accent, not an error look.</p>
      </header>

      <section className={styles.section}>
        <h2>Color</h2>
        <div className={styles.swatches}>
          {colors.map(([token, label]) => (
            <div key={token} className={styles.swatch}>
              <span className={styles.chip} style={{ background: `var(${token})` }} />
              <strong>{label}</strong>
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Type</h2>
        <div className={styles.typeList}>
          {typeScale.map(([token, label, family]) => (
            <div key={token} className={styles.typeRow}>
              <code>{token}</code>
              <span style={{ fontSize: `var(${token})`, fontFamily: `var(--font-${family})`, lineHeight: 1.2 }}>{family === "mono" ? "02:59:41" : label}</span>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Space, radius, elevation</h2>
        <div className={styles.spaceRow}>
          {spaces.map((token) => (
            <div key={token} className={styles.space}>
              <span style={{ width: `var(${token})`, height: `var(${token})` }} />
              <code>{token}</code>
            </div>
          ))}
        </div>
        <div className={styles.elevations}>
          {["--shadow-1", "--shadow-2", "--shadow-3"].map((token, index) => (
            <div key={token} className={styles.elevation} style={{ boxShadow: `var(${token})`, borderRadius: `var(${["--radius-sm", "--radius-md", "--radius-lg"][index]})` }}>
              <code>{token}</code>
            </div>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <h2>Actions and status</h2>
        <div className="row">
          <Button icon={<Icon name="lock" />}>Encrypt &amp; seal</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Reject</Button>
          <Button busy>Working</Button>
          <Button disabled>Disabled</Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
        </div>
        <div className="row">
          <Badge>neutral</Badge>
          <Badge tone="accent">sealed</Badge>
          <Badge tone="ok" dot>Open now</Badge>
          <Badge tone="warn">Awaiting quorum</Badge>
          <Badge tone="danger">denied</Badge>
          <Badge tone="info">Upcoming</Badge>
          <Hash value="q8Zt3c2bX0yJ1PZpVxN8T4mRk2wq9LhA0e5cVb7s1Ys=" />
          <Avatar name="An Nguyen" role="admin" />
          <Avatar name="Lan Vo" role="teacher" />
          <Avatar name="Minh Ho" role="student" />
        </div>
        <div className={styles.grid2}>
          <Alert tone="info" title="Information">Something worth knowing.</Alert>
          <Alert tone="ok" title="Paper sealed and stored">Only ciphertext left this browser.</Alert>
          <Alert tone="warn" title="Awaiting quorum">2 of 3 admins have signed.</Alert>
          <Alert tone="danger" title="Backend not reachable">Cannot reach http://localhost:4000.</Alert>
          <Alert tone="refused" title="Access refused by the network">Tags do not contain assignmentId.</Alert>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Form controls</h2>
        <div className={styles.grid3}>
          <Input label="Paper title" placeholder="Mathematics midterm" />
          <Input label="Group path" defaultValue="/class-10a" mono hint="Tide group" />
          <Input label="With error" defaultValue="10A" error="Group paths start with a slash." />
          <Select label="Kind" defaultValue="midterm">
            <option value="midterm">Midterm</option>
            <option value="final">Final</option>
          </Select>
          <Textarea label="Question 1" defaultValue="Prove that the square root of 2 is irrational." />
          <div className="stack">
            <span className="eyebrow">Persona switcher</span>
            <PersonaSwitcher current={personas[0]} personas={personas} onPick={() => undefined} />
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <h2>Navigation and data</h2>
        <Tabs tabs={[{ id: "one", label: "Users & roles" }, { id: "two", label: "Approvals", count: 2 }, { id: "three", label: "Audit log" }]} active={tab} onChange={setTab} label="Example tabs" />
        <TabPanel id={tab}>
          <Table<{ id: string; action: string; actor: string }>
            rowKey={(row) => row.id}
            rows={[
              { id: "1", action: "exam.upload", actor: "teacher.lan" },
              { id: "2", action: "exam.fetch.denied", actor: "admin.an" },
            ]}
            columns={[
              { key: "actor", label: "Actor", render: (row) => <span className="mono">{row.actor}</span> },
              { key: "action", label: "Action", render: (row) => <Badge tone={row.action.includes("denied") ? "danger" : "ok"}>{row.action}</Badge> },
            ]}
          />
        </TabPanel>
      </section>

      <section className={styles.section}>
        <h2>Time</h2>
        <div className="row" style={{ gap: "var(--space-12)" }}>
          <Countdown target={target} now={now} size="lg" />
          <Countdown target={target} now={now} label="Time left" />
          <Countdown target={0} now={now} doneLabel="Open now" />
        </div>
      </section>

      <section className={styles.section}>
        <h2>Threshold and quorum</h2>
        <Card title="NodeRing, live cycle" eyebrow="idle → pending → ok / refused / offline">
          <NodeRing nodes={liveNodes} threshold={3} okLabel="Released" centerTitle="Key shares" centerNote="Any 3 of 5 rebuild the key." />
        </Card>
        <div className={styles.grid2}>
          <Card title="NodeRing, all states" eyebrow="static">
            <NodeRing nodes={sampleNodes} threshold={3} showList={false} />
          </Card>
          <Card title="Stepper and progress">
            <Stepper
              label="Example"
              steps={[
                { id: "a", label: "Encrypt in this browser", state: "done", detail: "AES-GCM-256" },
                { id: "b", label: "Split the key 3-of-5", state: "done" },
                { id: "c", label: "Network attests", state: "active" },
                { id: "d", label: "Store ciphertext", state: "todo" },
                { id: "e", label: "Refused example", state: "failed", detail: "Policy expired." },
              ]}
            />
            <Progress value={2} max={3} label="Quorum" />
          </Card>
        </div>
        <Card tone="paper" title="QuorumMeter" eyebrow="change request" actions={<div className="row"><Button size="sm" variant="secondary" onClick={() => setApprovals((value) => Math.max(0, value - 1))}>−</Button><Button size="sm" variant="secondary" onClick={() => setApprovals((value) => Math.min(3, value + 1))}>+</Button></div>}>
          <QuorumMeter approvals={approvalList} threshold={3} status={approvals >= 3 ? "COMMITTED" : "PENDING"} names={{ "admin.an": "An Nguyen", "admin.binh": "Binh Tran", "admin.chi": "Chi Le" }} />
        </Card>
      </section>

      <section className={styles.section}>
        <h2>Paper</h2>
        <div className="row" style={{ gap: "var(--space-8)" }}>
          <Seal />
          <Seal label="Signed" sub="3 OF 3" />
          <Seal label="Opened" sub="3 OF 5 NODES" state="open" />
        </div>
        <ExamSheet paper={{ title: "Mathematics midterm", instructions: "Answer all questions. Show your working.", questions: ["Prove that the square root of 2 is irrational.", "A train leaves at 9:00 at 80 km/h. When does it cover 200 km?"], sealedAt: "" }} slotTitle="Midterm" className="Class 10A" />
      </section>
    </div>
  );
}
