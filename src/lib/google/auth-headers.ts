import type { GbpConnection } from "@/audit/types";

export function authHeadersForConnection(connection: GbpConnection): HeadersInit {
  return { Authorization: `Bearer ${connection.accessToken}` };
}
