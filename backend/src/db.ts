import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const file = process.env.DB_PATH ?? resolve(import.meta.dirname, "../data/exam-vault.db");
mkdirSync(dirname(file), { recursive: true });

export const db = new DatabaseSync(file);

db.exec(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS classes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    groupPath TEXT NOT NULL UNIQUE
  );
  CREATE TABLE IF NOT EXISTS slots (
    id TEXT PRIMARY KEY,
    classId TEXT NOT NULL,
    title TEXT NOT NULL,
    kind TEXT NOT NULL,
    startsAt TEXT NOT NULL,
    endsAt TEXT NOT NULL,
    teacher TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS exams (
    slotId TEXT PRIMARY KEY,
    bundle TEXT NOT NULL,
    digest TEXT NOT NULL,
    attestations TEXT NOT NULL,
    uploadedBy TEXT NOT NULL,
    uploadedAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS policies (
    id TEXT PRIMARY KEY,
    slotId TEXT NOT NULL,
    audience TEXT NOT NULL,
    subjectType TEXT NOT NULL,
    subjectId TEXT NOT NULL,
    signed TEXT NOT NULL,
    createdAt TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at TEXT NOT NULL,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    target TEXT NOT NULL,
    detail TEXT NOT NULL,
    prevHash TEXT NOT NULL,
    hash TEXT NOT NULL
  );
  INSERT OR IGNORE INTO classes (id, name, groupPath) VALUES ('class-10a', '10A', '/class-10a');
  INSERT OR IGNORE INTO classes (id, name, groupPath) VALUES ('class-10b', '10B', '/class-10b');
`);

export type ClassRow = { id: string; name: string; groupPath: string };
export type SlotRow = {
  id: string;
  classId: string;
  title: string;
  kind: string;
  startsAt: string;
  endsAt: string;
  teacher: string;
};
export type ExamRow = {
  slotId: string;
  bundle: string;
  digest: string;
  attestations: string;
  uploadedBy: string;
  uploadedAt: string;
};
export type PolicyRow = {
  id: string;
  slotId: string;
  audience: string;
  subjectType: string;
  subjectId: string;
  signed: string;
  createdAt: string;
};

export function listClasses(): ClassRow[] {
  return db.prepare("SELECT id, name, groupPath FROM classes ORDER BY name").all() as ClassRow[];
}

export function getClass(id: string): ClassRow | undefined {
  return db.prepare("SELECT id, name, groupPath FROM classes WHERE id = ?").get(id) as ClassRow | undefined;
}

export function getSlot(id: string): SlotRow | undefined {
  return db.prepare("SELECT * FROM slots WHERE id = ?").get(id) as SlotRow | undefined;
}

export function listSlots(): SlotRow[] {
  return db.prepare("SELECT * FROM slots ORDER BY startsAt").all() as SlotRow[];
}

export function getExam(slotId: string): ExamRow | undefined {
  return db.prepare("SELECT * FROM exams WHERE slotId = ?").get(slotId) as ExamRow | undefined;
}

export function findPolicies(slotId: string, audience: string): PolicyRow[] {
  return db
    .prepare("SELECT * FROM policies WHERE slotId = ? AND audience = ? ORDER BY createdAt DESC")
    .all(slotId, audience) as PolicyRow[];
}

export function slotStatus(slot: SlotRow, now = Date.now()): "upcoming" | "open" | "closed" {
  if (now < Date.parse(slot.startsAt)) return "upcoming";
  if (now < Date.parse(slot.endsAt)) return "open";
  return "closed";
}
