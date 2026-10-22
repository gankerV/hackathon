"use client";

import { AdminConsole } from "@/components/admin/AdminConsole";
import { RoleGate } from "@/components/app/RoleGate";

export default function AdminPage() {
  return (
    <RoleGate role="admin">
      <AdminConsole />
    </RoleGate>
  );
}
