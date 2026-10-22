import { Router } from "express";
import { getKeys } from "../keys.ts";
import { NODE_THRESHOLD, findUser, getState } from "../state.ts";
import { issueToken } from "../token.ts";
import { Refusal } from "../types.ts";

export const publicRoutes = Router();

publicRoutes.get("/jwks", (_req, res) => {
  res.json({ keys: [getKeys().tokenPublicJwk] });
});

publicRoutes.get("/network", (_req, res) => {
  res.json({
    networkKey: getKeys().networkPublicRaw,
    threshold: NODE_THRESHOLD,
    nodes: getState().nodes.map((node) => ({ id: node.id, publicKey: node.publicKey, online: node.online })),
  });
});

publicRoutes.get("/demo-users", (_req, res) => {
  res.json(getState().users.map(({ username, name, roles, groups }) => ({ username, name, roles, groups })));
});

publicRoutes.post("/login", async (req, res) => {
  const user = findUser(String(req.body?.username ?? ""));
  if (!user) throw new Refusal(404, "Unknown username.");
  res.json({ token: await issueToken(user), user });
});
