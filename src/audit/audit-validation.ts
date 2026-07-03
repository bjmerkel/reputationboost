import type { ClientConfig, FullAuditPayload, Phase1AuditPayload } from "./types";

export function auditBelongsToBusiness(
  audit: FullAuditPayload | Phase1AuditPayload,
  business: Pick<ClientConfig, "id" | "name" | "businessId">,
  userId?: string
): boolean {
  if (userId && audit.userId && audit.userId !== userId) {
    return false;
  }

  if (audit.clientId === business.id) {
    return true;
  }

  if (audit.clientName === business.name) {
    return true;
  }

  return false;
}
