import type { ReactNode } from "react";
import type { ClassRoom, Slot } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { ChangeRequest, DirectoryUser } from "@/lib/tide";

const labels: Record<string, string> = {
  "user.addRole": "Grant role",
  "user.removeRole": "Remove role",
  "user.addGroup": "Add to group",
  "user.removeGroup": "Remove from group",
  "policy.sign": "Sign access policy",
};

export function requestTitle(request: ChangeRequest) {
  return labels[request.type] ?? request.type;
}

function windowText(notBefore: number, expiry: number) {
  const from = notBefore > 0 ? formatDateTime(notBefore * 1000) : "now";
  return `${from} → ${formatDateTime(expiry * 1000)}`;
}

export function requestSummary(request: ChangeRequest, users: DirectoryUser[], slots: Slot[], classes: ClassRoom[]): ReactNode {
  const payload = request.payload as Record<string, string | number>;
  if (request.type === "policy.sign") {
    const slot = slots.find((item) => item.id === payload.assignmentId);
    const room = classes.find((item) => item.id === slot?.classId);
    const subject = payload.subjectType === "User" ? users.find((item) => item.tideuserkey === payload.subjectId) : null;
    const who = subject ? `${subject.name} (${subject.username})` : String(payload.subjectId);
    return (
      <>
        <strong>{String(payload.label ?? "").toUpperCase() || "POLICY"}</strong> · {String(payload.access)} access for <strong>{who}</strong> on <em>{slot ? `${slot.title}${room ? `, ${room.name}` : ""}` : String(payload.assignmentId)}</em>
        <br />
        <span className="mono">valid {windowText(Number(payload.notBefore ?? 0), Number(payload.expiry ?? 0))}</span>
      </>
    );
  }
  const target = users.find((item) => item.username === payload.username);
  const value = payload.role ?? payload.group;
  return (
    <>
      <code>{String(value)}</code> {request.type.endsWith("Role") || request.type.endsWith("Group") ? (request.type.includes("remove") ? "from" : "for") : ""} <strong>{target ? `${target.name} (${target.username})` : String(payload.username)}</strong>
    </>
  );
}
