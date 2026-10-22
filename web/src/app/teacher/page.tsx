"use client";

import { RoleGate } from "@/components/app/RoleGate";
import { TeacherDesk } from "./TeacherDesk";

export default function TeacherPage() {
  return (
    <RoleGate role="teacher">
      <TeacherDesk />
    </RoleGate>
  );
}
