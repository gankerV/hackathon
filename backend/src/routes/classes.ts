import { Router } from "express";
import { db, getClass, listClasses } from "../db";
import { currentUser, requireRole } from "../auth";
import { addAudit } from "../audit";

export const classRoutes = Router();

classRoutes.get("/", (req, res) => {
  res.json(listClasses());
});

classRoutes.post("/", requireRole("admin"), (req, res) => {
  const user = currentUser(res);
  const { name, groupPath } = req.body ?? {};
  if (typeof name !== "string" || !name.trim() || typeof groupPath !== "string" || !/^\/[^/\s]+/.test(groupPath)) {
    res.status(400).json({ error: "Body must be {name, groupPath} with groupPath like /class-10a" });
    return;
  }
  const id = groupPath.slice(1).toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const taken = getClass(id) ?? db.prepare("SELECT id FROM classes WHERE groupPath = ?").get(groupPath);
  if (taken) {
    res.status(409).json({ error: "Class already exists" });
    return;
  }
  db.prepare("INSERT INTO classes (id, name, groupPath) VALUES (?, ?, ?)").run(id, name.trim(), groupPath);
  addAudit(user.username, "class.create", id, { name: name.trim(), groupPath });
  res.status(201).json({ id, name: name.trim(), groupPath });
});
