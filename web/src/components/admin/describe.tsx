import type { ClassRoom, Slot } from "@/lib/api";
import type { ChangeRequest, DirectoryUser } from "@/lib/tide";

export function describeRequest(request: ChangeRequest, users: DirectoryUser[], slots: Slot[], classes: ClassRoom[]) {
  const payload = request.payload as Record<string, string | number>;
  if (request.type === "policy.sign") {
    const slot = slots.find((item) => item.id === payload.assignmentId);
    const room = classes.find((item) => item.id === slot?.classId);
    const subject = payload.subjectType === "User" ? users.find((item) => item.tideuserkey === payload.subjectId)?.name : null;
    const who = subject ?? (payload.label === "class" && room ? `class ${room.name}` : String(payload.subjectId));
    const where = slot ? `${slot.title}${room ? ` (${room.name})` : ""}` : String(payload.assignmentId);
    return `${payload.access === "read" ? "Read" : "Read and write"} access to ${where} for ${who}`;
  }
  const name = users.find((item) => item.username === payload.username)?.name ?? String(payload.username);
  const value = String(payload.role ?? payload.group);
  if (request.type === "user.addRole") return `Give ${name} the role ${value}`;
  if (request.type === "user.removeRole") return `Remove role ${value} from ${name}`;
  if (request.type === "user.addGroup") return `Add ${name} to ${value}`;
  return `Remove ${name} from ${value}`;
}
