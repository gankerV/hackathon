import type { Request, Response, NextFunction } from "express";
import type { JWTPayload } from "jose";
import { checkToken, TideDownError } from "./tide";

export type User = {
  id: string;
  username: string;
  name: string;
  roles: string[];
  groups: string[];
  userKey: string;
  claims: JWTPayload;
};

function readUser(claims: JWTPayload): User {
  const realm = claims.realm_access as { roles?: unknown } | undefined;
  const roles = Array.isArray(realm?.roles) ? realm.roles.filter((role): role is string => typeof role === "string") : [];
  const groups = Array.isArray(claims.groups)
    ? claims.groups.filter((group): group is string => typeof group === "string")
    : [];
  return {
    id: String(claims.sub ?? ""),
    username: String(claims.preferred_username ?? ""),
    name: String(claims.name ?? ""),
    roles,
    groups,
    userKey: String(claims.tideuserkey ?? ""),
    claims,
  };
}

export async function requireUser(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header);
  if (!match) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  try {
    const claims = await checkToken(match[1]);
    const user = readUser(claims);
    if (!user.username) {
      res.status(401).json({ error: "Token has no preferred_username" });
      return;
    }
    res.locals.user = user;
    next();
  } catch (error) {
    if (error instanceof TideDownError) {
      res.status(503).json({ error: error.message });
      return;
    }
    res.status(401).json({ error: "Invalid token", reason: (error as Error).message });
  }
}

export function currentUser(res: Response): User {
  return res.locals.user as User;
}

export function hasRole(user: User, role: string): boolean {
  return user.roles.includes(role);
}

export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!hasRole(currentUser(res), role)) {
      res.status(403).json({ error: `Requires role ${role}` });
      return;
    }
    next();
  };
}
