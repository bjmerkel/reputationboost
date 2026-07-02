export const GBP_OAUTH_SCOPE = "https://www.googleapis.com/auth/business.manage";

export function getGoogleClientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID;
}

export function getGoogleClientSecret(): string | undefined {
  return process.env.GOOGLE_CLIENT_SECRET;
}

export function getGoogleOAuthRedirectUri(): string {
  const override = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (override) return override;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${siteUrl.replace(/\/$/, "")}/api/google/gbp/callback`;
}

export function isGoogleOAuthConfigured(): boolean {
  return Boolean(getGoogleClientId() && getGoogleClientSecret());
}
