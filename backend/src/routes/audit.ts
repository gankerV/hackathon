import { Router } from "express";
import { currentUser, requireRole } from "../auth";
import { addAudit, readAudit } from "../audit";

export const auditRoutes = Router();

auditRoutes.post("/", (req, res) => {
  const user = currentUser(res);
  const { action, target, detail } = req.body ?? {};
  if (typeof action !== "string" || !/^[\w.:-]{1,100}$/.test(action)) {
    res.status(400).json({ error: "Body must be {action, target, detail} with a short action name" });
    return;
  }
  const entry = addAudit(user.username, action, typeof target === "string" ? target : "", detail ?? null);
  res.status(201).json(entry);
});

auditRoutes.get("/", requireRole("admin"), (req, res) => {
  res.json(readAudit());
});
