import { decodeJwt } from "jose";
import type { TideUser } from "./types";

const KEY = "exam-vault.token";
const EVENT = "exam-vault:session";

export function readToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = window.sessionStorage.getItem(KEY);
  if (!token) return null;
  const user = readUser(token);
  if (!user || user.exp * 1000 <= Date.now()) {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
  return token;
}

export function saveToken(token: string | null) {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(KEY, token);
  else window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function watchToken(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function readUser(token: string): TideUser | null {
  try {
    const claims = decodeJwt(token) as Record<string, unknown>;
    const realm = (claims.realm_access ?? {}) as { roles?: string[] };
    return {
      sub: String(claims.sub ?? ""),
      username: String(claims.preferred_username ?? ""),
      name: String(claims.name ?? claims.preferred_username ?? ""),
      roles: Array.isArray(realm.roles) ? realm.roles : [],
      groups: Array.isArray(claims.groups) ? (claims.groups as string[]) : [],
      tideuserkey: String(claims.tideuserkey ?? ""),
      exp: Number(claims.exp ?? 0),
    };
  } catch {
    return null;
  }
}
