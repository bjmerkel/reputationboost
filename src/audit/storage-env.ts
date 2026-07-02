/**
 * Local JSON audit files only work in persistent environments (local dev, VPS).
 * Vercel serverless has a read-only filesystem — use Supabase there instead.
 */
export function isLocalStorageAvailable(): boolean {
  if (process.env.VERCEL === "1" || process.env.VERCEL === "true") {
    return false;
  }
  return true;
}
