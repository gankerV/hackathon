"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui";
import { useTide } from "@/lib/tide";

export function RoleGate({ role, children }: { role: string; children: ReactNode }) {
  const { ready, user } = useTide();
  if (!ready) return <div className="page" aria-busy="true" />;
  if (!user) {
    return (
      <div className="page">
        <Alert tone="info" title={<>Please <Link href="/">sign in</Link> first.</>} />
      </div>
    );
  }
  if (!user.roles.includes(role)) {
    return (
      <div className="page">
        <Alert tone="refused" title={`${user.name} is not a ${role}.`} />
      </div>
    );
  }
  return <>{children}</>;
}
