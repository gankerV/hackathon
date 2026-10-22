"use client";

import { RoleGate } from "@/components/app/RoleGate";
import { StudentDesk } from "./StudentDesk";

export default function StudentPage() {
  return (
    <RoleGate role="student">
      <StudentDesk />
    </RoleGate>
  );
}
