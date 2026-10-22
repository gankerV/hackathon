"use client";

import { useState } from "react";
import { Alert, TabPanel, Tabs } from "@/components/ui";
import { ApprovalsTab } from "./ApprovalsTab";
import { AuditTab } from "./AuditTab";
import { ExamsTab } from "./ExamsTab";
import styles from "./Admin.module.css";
import { useAdminData } from "./useAdminData";

export function AdminConsole() {
  const data = useAdminData();
  const [tab, setTab] = useState("exams");
  const pending = data.requests.filter((item) => item.status === "PENDING").length;

  const tabs = [
    { id: "exams", label: "Exams" },
    { id: "approvals", label: "Approvals", count: pending },
    { id: "audit", label: "Audit log" },
  ];

  return (
    <div className="page">
      <div className={styles.intro}>
        <h1>Admin</h1>
        <p className="muted">Every access grant needs 3 admin approvals.</p>
      </div>
      {data.tideError ? <Alert tone="danger" title={data.tideError} /> : null}
      <Tabs tabs={tabs} active={tab} onChange={setTab} label="Admin sections" />
      <TabPanel id={tab}>
        {tab === "exams" ? <ExamsTab data={data} /> : null}
        {tab === "approvals" ? <ApprovalsTab data={data} /> : null}
        {tab === "audit" ? <AuditTab /> : null}
      </TabPanel>
    </div>
  );
}
