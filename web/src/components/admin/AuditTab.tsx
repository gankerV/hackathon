"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, Hash, Icon, Table } from "@/components/ui";
import { getAudit } from "@/lib/api";
import type { AuditEntry } from "@/lib/api";
import { errorText, formatDateTime } from "@/lib/format";
import styles from "./Admin.module.css";

function actionTone(action: string) {
  if (action.includes("denied") || action.includes("refused") || action.includes("reject")) return "danger" as const;
  if (action.startsWith("cr.")) return "accent" as const;
  if (action.includes("decrypt.ok") || action.includes("upload") || action.includes("store")) return "ok" as const;
  return "neutral" as const;
}

function detailText(detail: unknown) {
  if (detail === null || detail === undefined || detail === "") return "";
  if (typeof detail === "string") {
    try {
      return JSON.stringify(JSON.parse(detail));
    } catch {
      return detail;
    }
  }
  return JSON.stringify(detail);
}

export function AuditTab() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [chainValid, setChainValid] = useState<boolean | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const data = await getAudit();
      setEntries(data.entries);
      setChainValid(data.chainValid);
      setProblem(null);
    } catch (error) {
      setProblem(errorText(error));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="row">
          {chainValid === null ? null : chainValid ? (
            <Badge tone="ok" dot>Chain valid</Badge>
          ) : (
            <Badge tone="danger" dot>Hash chain broken</Badge>
          )}
        </div>
        <Button variant="secondary" size="sm" icon={<Icon name="chain" />} onClick={load} busy={busy}>
          Refresh
        </Button>
      </div>
      {problem ? <Alert tone="danger" title={problem} /> : null}
      <Table<AuditEntry>
        rowKey={(row) => String(row.id ?? row.hash)}
        rows={entries}
        empty="No audit entries yet."
        columns={[
          { key: "at", label: "When", render: (row) => <span className="mono">{formatDateTime(row.at)}</span>, width: "11rem" },
          { key: "actor", label: "Actor", render: (row) => <span className="mono">{row.actor}</span> },
          { key: "action", label: "Action", render: (row) => <Badge tone={actionTone(row.action)}>{row.action}</Badge> },
          { key: "target", label: "Target", render: (row) => <span className="mono">{row.target}</span> },
          { key: "detail", label: "Detail", render: (row) => <span className={styles.detail}>{detailText(row.detail)}</span> },
          { key: "hash", label: "Hash", render: (row) => <Hash value={row.hash ?? ""} head={8} tail={4} /> },
        ]}
      />
    </div>
  );
}
