"use client";

import { useState } from "react";
import { Alert, TabPanel, Tabs } from "@/components/ui";
import { useTide } from "@/lib/tide";
import { AccessTab } from "./AccessTab";
import { ApprovalsTab } from "./ApprovalsTab";
import { AuditTab } from "./AuditTab";
import { ClassesTab } from "./ClassesTab";
import { NetworkTab } from "./NetworkTab";
import { UsersTab } from "./UsersTab";
import styles from "./Admin.module.css";
import { useAdminData } from "./useAdminData";

export function AdminConsole() {
  const { user } = useTide();
  const data = useAdminData();
  const [tab, setTab] = useState("approvals");
  const pending = data.requests.filter((item) => item.status === "PENDING").length;
  const toApprovals = () => setTab("approvals");

  const tabs = [
    { id: "users", label: "Users & roles" },
    { id: "classes", label: "Classes & exams" },
    { id: "approvals", label: "Approvals", count: pending },
    { id: "access", label: "Access to exam" },
    { id: "audit", label: "Audit log" },
    { id: "network", label: "Network" },
  ];

  return (
    <div className="page">
      <div className={styles.intro}>
        <span className="eyebrow">Admin · {user?.name}</span>
        <h1>Governance, not custody</h1>
        <p className="muted">You manage people, classes and schedules. You never hold exam keys. Every grant of access goes through a 3-admin quorum, and the ORK network enforces the result.</p>
      </div>
      {data.tideError ? <Alert tone="danger" title="Tide network not reachable">{data.tideError}</Alert> : null}
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Admin sections" />
      <TabPanel id={tab}>
        {tab === "users" ? <UsersTab data={data} onProposed={toApprovals} /> : null}
        {tab === "classes" ? <ClassesTab data={data} onProposed={toApprovals} /> : null}
        {tab === "approvals" ? <ApprovalsTab data={data} /> : null}
        {tab === "access" ? <AccessTab data={data} onProposed={toApprovals} /> : null}
        {tab === "audit" ? <AuditTab /> : null}
        {tab === "network" ? <NetworkTab /> : null}
      </TabPanel>
    </div>
  );
}
