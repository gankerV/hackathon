"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui";
import { useTide } from "@/lib/tide";

export function RoleGate({ role, children }: { role: string; children: ReactNode }) {
  const { ready, user } = useTide();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/login");
  }, [ready, user, router]);

  if (!ready || !user) return <div className="page" aria-busy="true" />;
  if (!user.roles.includes(role)) {
    return (
      <div className="page">
        <Alert tone="refused" title={<>{user.name} is not a {role}. <Link href="/login">Sign in as someone else</Link>.</>} />
      </div>
    );
  }
  return <>{children}</>;
}
