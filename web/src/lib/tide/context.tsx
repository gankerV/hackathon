"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { signIn, signOut } from "./client";
import { readToken, readUser, watchToken } from "./session";
import type { TideUser } from "./types";
import { doDecrypt, doEncrypt } from "./vault";

type TideValue = {
  ready: boolean;
  token: string | null;
  user: TideUser | null;
  hasRole: (role: string) => boolean;
  inGroup: (group: string) => boolean;
  signIn: typeof signIn;
  signOut: typeof signOut;
  doEncrypt: typeof doEncrypt;
  doDecrypt: typeof doDecrypt;
};

const TideContext = createContext<TideValue | null>(null);

export function TideProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setToken(readToken());
    setReady(true);
    return watchToken(() => setToken(readToken()));
  }, []);

  const user = useMemo(() => (token ? readUser(token) : null), [token]);
  const hasRole = useCallback((role: string) => Boolean(user?.roles.includes(role)), [user]);
  const inGroup = useCallback((group: string) => Boolean(user?.groups.includes(group)), [user]);

  const value = useMemo<TideValue>(() => ({ ready, token, user, hasRole, inGroup, signIn, signOut, doEncrypt, doDecrypt }), [ready, token, user, hasRole, inGroup]);
  return <TideContext.Provider value={value}>{children}</TideContext.Provider>;
}

export function useTide() {
  const value = useContext(TideContext);
  if (!value) throw new Error("useTide must be used inside TideProvider.");
  return value;
}
