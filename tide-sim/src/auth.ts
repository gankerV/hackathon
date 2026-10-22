import type { NextFunction, Request, Response } from "express";
import { readToken } from "./token.ts";
import { Refusal, type Claims } from "./types.ts";

export function getCaller(res: Response): Claims {
  return res.locals.caller as Claims;
}

export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const caller = await readToken(req.headers.authorization);
  if (!(caller.realm_access?.roles ?? []).includes("admin")) throw new Refusal(403, "Admin role required.");
  res.locals.caller = caller;
  next();
}
