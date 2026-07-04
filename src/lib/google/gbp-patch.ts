import type { GbpConnection } from "@/audit/types";
import { patchGbpLocation } from "./gbp-location";

/** Validate then apply a Business Information API location patch. */
export async function patchGbpLocationValidated(
  connection: GbpConnection,
  updateMask: string,
  body: Record<string, unknown>
): Promise<void> {
  await patchGbpLocation(connection, updateMask, body, true);
  await patchGbpLocation(connection, updateMask, body, false);
}
