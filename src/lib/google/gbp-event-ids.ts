/** Nightly/audit scan-managed alert ids (not Pub/Sub one-shots). */
export function isScanManagedExternalId(externalId: string | null | undefined): boolean {
  if (!externalId) return false;
  return externalId.startsWith("nightly:") || externalId.startsWith("audit:");
}
