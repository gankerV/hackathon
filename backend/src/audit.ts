import { db } from "./db";
import { canonicalJson, sha256Hex } from "./canonical";

type AuditRow = {
  id: number;
  at: string;
  actor: string;
  action: string;
  target: string;
  detail: string;
  prevHash: string;
  hash: string;
};

function makeHash(prevHash: string, at: string, actor: string, action: string, target: string, detail: unknown): string {
  return sha256Hex(prevHash + canonicalJson({ at, actor, action, target, detail }));
}

export function addAudit(actor: string, action: string, target: string, detail: unknown = null) {
  const at = new Date().toISOString();
  const last = db.prepare("SELECT hash FROM audit ORDER BY id DESC LIMIT 1").get() as { hash: string } | undefined;
  const prevHash = last?.hash ?? "";
  const cleanDetail = detail === undefined ? null : JSON.parse(JSON.stringify(detail));
  const hash = makeHash(prevHash, at, actor, action, target, cleanDetail);
  const result = db
    .prepare("INSERT INTO audit (at, actor, action, target, detail, prevHash, hash) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(at, actor, action, target, JSON.stringify(cleanDetail), prevHash, hash);
  return { id: Number(result.lastInsertRowid), at, hash };
}

export function readAudit() {
  const rows = db.prepare("SELECT * FROM audit ORDER BY id ASC").all() as AuditRow[];
  let chainValid = true;
  let prevHash = "";
  const entries = rows.map((row) => {
    const detail = JSON.parse(row.detail);
    const expected = makeHash(prevHash, row.at, row.actor, row.action, row.target, detail);
    if (row.prevHash !== prevHash || row.hash !== expected) chainValid = false;
    prevHash = row.hash;
    return { ...row, detail };
  });
  return { entries: entries.reverse(), chainValid };
}
