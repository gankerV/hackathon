import { readSignedPolicy, savePolicy, sendAudit } from "@/lib/api";
import { createChangeRequest } from "@/lib/tide";
import type { ChangeRequest, PolicyRequest } from "@/lib/tide";

export function audienceOf(request: ChangeRequest): "teacher" | "class" | "admin" {
  const label = String((request.payload as Record<string, unknown>).label ?? "");
  if (label === "teacher" || label === "class" || label === "admin") return label;
  const subjectType = String((request.payload as Record<string, unknown>).subjectType ?? "");
  return subjectType === "Group" ? "class" : "teacher";
}

export async function storePolicy(request: ChangeRequest) {
  const payload = request.payload as Record<string, unknown>;
  const slotId = String(payload.assignmentId);
  const audience = audienceOf(request);
  await savePolicy(slotId, audience, readSignedPolicy(request.result));
  return { slotId, audience };
}

export async function proposePolicy(input: PolicyRequest) {
  const request = await createChangeRequest("policy.sign", input);
  sendAudit("cr.create", request.id, { type: "policy.sign", label: input.label, assignmentId: input.assignmentId, subjectType: input.subjectType });
  return request;
}

export async function proposeChange(type: "user.addRole" | "user.removeRole" | "user.addGroup" | "user.removeGroup", payload: Record<string, string>) {
  const request = await createChangeRequest(type, payload);
  sendAudit("cr.create", request.id, { type, ...payload });
  return request;
}
