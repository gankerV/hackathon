"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Alert, Card } from "@/components/ui";
import { useTide } from "@/lib/tide";

export function RoleGate({ role, children }: { role: string; children: ReactNode }) {
  const { ready, user } = useTide();
  if (!ready) return <div className="page" aria-busy="true" />;
  if (!user) {
    return (
      <div className="page">
        <Card title="Sign in first" eyebrow="Simulated Tide sign-in">
          <p className="muted">
            This page needs a signed-in {role}. Pick a persona on the <Link href="/">start page</Link> or from the switcher in the header.
          </p>
        </Card>
      </div>
    );
  }
  if (!user.roles.includes(role)) {
    return (
      <div className="page">
        <Alert tone="refused" title={`${user.name} does not hold the "${role}" role`}>
          Roles come from the signed Tide token, not from this page. Switch persona in the header to continue.
        </Alert>
      </div>
    );
  }
  return <>{children}</>;
}
