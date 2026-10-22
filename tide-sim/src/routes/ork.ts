import { Router, type Request } from "express";
import { canonicalJson } from "../canonical.ts";
import { getKeys, signWithNetwork } from "../keys.ts";
import { checkPolicy } from "../policy.ts";
import { unwrapShare } from "../share.ts";
import { findNode, saveState } from "../state.ts";
import { readToken } from "../token.ts";
import { Refusal } from "../types.ts";

export const orkRoutes = Router();

function getNode(req: Request) {
  const node = findNode(Number(req.params.node));
  if (!node) throw new Refusal(404, "Unknown ORK node.");
  return node;
}

async function checkRequest(req: Request, role: string) {
  const node = getNode(req);
  if (!node.online) throw new Refusal(503, `ORK node ${node.id} is offline.`);
  const caller = await readToken(req.headers.authorization);
  const tag = req.body?.tag;
  if (typeof tag !== "string" || !tag) throw new Refusal(400, "Missing tag.");
  await checkPolicy(req.body?.signedPolicy, tag, caller, role);
  return { node, caller, tag };
}

orkRoutes.post("/ork/:node/toggle", (req, res) => {
  const node = getNode(req);
  node.online = !node.online;
  saveState();
  res.json({ id: node.id, online: node.online });
});

orkRoutes.post("/ork/:node/authorize-encrypt", async (req, res) => {
  const { node, caller, tag } = await checkRequest(req, "_tide_encryptor");
  const digest = req.body?.digest;
  if (typeof digest !== "string" || !digest) throw new Refusal(400, "Missing digest.");
  const statement = { node: node.id, tag, digest, by: caller.preferred_username };
  res.json({ node: node.id, attestation: await signWithNetwork(canonicalJson(statement)) });
});

orkRoutes.post("/ork/:node/release-share", async (req, res) => {
  const { node, tag } = await checkRequest(req, "_tide_decryptor");
  const privateKey = getKeys().nodePrivate.get(node.id);
  if (!privateKey) throw new Refusal(500, "Node key missing.");
  res.json({ node: node.id, share: await unwrapShare(privateKey, tag, req.body?.wrappedShare) });
});
