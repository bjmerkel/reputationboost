/**
 * Client helper to set Profile Guide background image from GBP photo URLs.
 */
export async function setProfileGuideBackgroundImage(imageUrl: string | null): Promise<void> {
  const res = await fetch("/api/profile-guide", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ backgroundImageUrl: imageUrl }),
  });

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "Failed to update Profile Guide background");
  }
}

export async function fetchProfileGuideBackgroundImage(): Promise<string | null> {
  const res = await fetch("/api/profile-guide");
  if (!res.ok) return null;
  const data = (await res.json()) as { guide?: { backgroundImageUrl?: string | null } };
  return data.guide?.backgroundImageUrl ?? null;
}
