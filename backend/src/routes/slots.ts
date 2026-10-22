import { Router } from "express";
import { randomBytes } from "node:crypto";
import { db, findPolicies, getClass, getExam, listClasses, listSlots, slotStatus, type SlotRow } from "../db";
import { currentUser, hasRole, requireRole, type User } from "../auth";
import { addAudit } from "../audit";

export const slotRoutes = Router();

function canSeeSlot(user: User, slot: SlotRow, groupByClass: Map<string, string>): boolean {
  if (hasRole(user, "admin")) return true;
  if (hasRole(user, "teacher") && slot.teacher === user.username) return true;
  const groupPath = groupByClass.get(slot.classId);
  return !!groupPath && user.groups.includes(groupPath);
}

export function describeSlot(slot: SlotRow, now = Date.now()) {
  const cls = getClass(slot.classId);
  return {
    ...slot,
    className: cls?.name ?? null,
    groupPath: cls?.groupPath ?? null,
    status: slotStatus(slot, now),
    hasExam: !!getExam(slot.id),
    policies: {
      teacher: findPolicies(slot.id, "teacher").length > 0,
      class: findPolicies(slot.id, "class").length > 0,
    },
  };
}

slotRoutes.get("/", (req, res) => {
  const user = currentUser(res);
  const groupByClass = new Map(listClasses().map((cls) => [cls.id, cls.groupPath]));
  const now = Date.now();
  res.json(listSlots().filter((slot) => canSeeSlot(user, slot, groupByClass)).map((slot) => describeSlot(slot, now)));
});

function readTime(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const time = new Date(value);
  return Number.isNaN(time.getTime()) ? null : time.toISOString();
}

slotRoutes.post("/", requireRole("admin"), (req, res) => {
  const user = currentUser(res);
  const { classId, title, kind, teacher } = req.body ?? {};
  const startsAt = readTime(req.body?.startsAt);
  const endsAt = readTime(req.body?.endsAt);
  if (
    typeof classId !== "string" ||
    typeof title !== "string" ||
    !title.trim() ||
    (kind !== "midterm" && kind !== "final") ||
    typeof teacher !== "string" ||
    !teacher.trim() ||
    !startsAt ||
    !endsAt
  ) {
    res.status(400).json({
      error: "Body must be {classId, title, kind: midterm|final, startsAt, endsAt, teacher}",
    });
    return;
  }
  if (Date.parse(endsAt) <= Date.parse(startsAt)) {
    res.status(400).json({ error: "endsAt must be after startsAt" });
    return;
  }
  if (!getClass(classId)) {
    res.status(404).json({ error: "Class not found" });
    return;
  }
  const existing = db.prepare("SELECT kind FROM slots WHERE classId = ?").all(classId) as { kind: string }[];
  if (existing.length >= 2 || existing.some((slot) => slot.kind === kind)) {
    res.status(409).json({ error: `Class already has a ${kind} slot (max one midterm and one final per term)` });
    return;
  }
  const slot: SlotRow = {
    id: `slot_${randomBytes(6).toString("hex")}`,
    classId,
    title: title.trim(),
    kind,
    startsAt,
    endsAt,
    teacher: teacher.trim(),
  };
  db.prepare(
    "INSERT INTO slots (id, classId, title, kind, startsAt, endsAt, teacher) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(slot.id, slot.classId, slot.title, slot.kind, slot.startsAt, slot.endsAt, slot.teacher);
  addAudit(user.username, "slot.create", slot.id, {
    classId,
    title: slot.title,
    kind,
    startsAt,
    endsAt,
    teacher: slot.teacher,
  });
  res.status(201).json(describeSlot(slot));
});
