import { sendAdminWeeklyDigest } from "@/lib/admin/digest";

export async function runAdminWeeklyDigest(options?: { force?: boolean }) {
  return sendAdminWeeklyDigest(options);
}
