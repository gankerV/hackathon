import { Router } from "express";
import { getCaller, requireAdmin } from "../auth.ts";
import { approveRequest, createRequest, listRequests, rejectRequest } from "../requests.ts";
import { getState } from "../state.ts";

export const adminRoutes = Router();

adminRoutes.get("/users", requireAdmin, (_req, res) => {
  res.json(getState().users);
});

adminRoutes.get("/change-requests", requireAdmin, (_req, res) => {
  res.json(listRequests());
});

adminRoutes.post("/change-requests", requireAdmin, (req, res) => {
  const request = createRequest(String(req.body?.type ?? ""), req.body?.payload, getCaller(res).preferred_username);
  res.status(201).json(request);
});

adminRoutes.post("/change-requests/:id/approve", requireAdmin, async (req, res) => {
  res.json(await approveRequest(String(req.params.id), getCaller(res).preferred_username));
});

adminRoutes.post("/change-requests/:id/reject", requireAdmin, (req, res) => {
  res.json(rejectRequest(String(req.params.id)));
});
