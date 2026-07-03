import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";

const ACCOUNT_MANAGEMENT_BASE = "https://mybusinessaccountmanagement.googleapis.com/v1";

export type GbpAdminRole =
  | "PRIMARY_OWNER"
  | "OWNER"
  | "MANAGER"
  | "SITE_MANAGER"
  | "ADMIN_ROLE_UNSPECIFIED"
  | "UNKNOWN";

export interface GbpAdminRecord {
  email?: string;
  displayName?: string;
  role: GbpAdminRole;
  pendingInvitation: boolean;
  source: "location" | "account";
}

export type GbpAccessStatus =
  | "confirmed_manager"
  | "site_manager_only"
  | "no_admin_match"
  | "cannot_list_admins"
  | "account_mismatch"
  | "check_failed";

export interface GbpLocationAccessCheck {
  status: GbpAccessStatus;
  /** Google account authorized for GBP OAuth — not the Reputation Boost sign-in. */
  googleAccountEmail?: string;
  /** Supabase / app sign-in email, when provided. */
  platformEmail?: string;
  accountMismatch: boolean;
  matchedRole?: GbpAdminRole;
  admins: GbpAdminRecord[];
  headline: string;
  detail: string;
  suggestion: string;
  severity: "info" | "warning";
  /** @deprecated Use googleAccountEmail */
  connectedEmail?: string;
}

interface AdminApiRecord {
  admin?: string;
  role?: string;
  pendingInvitation?: boolean;
}

function normalizeLocationId(locationId: string): string {
  return locationId.replace(/^locations\//, "");
}

function normalizeAccountId(accountId: string): string {
  return accountId.replace(/^accounts\//, "");
}

function normalizeEmail(email?: string): string | undefined {
  return email?.trim().toLowerCase() || undefined;
}

function parseAdminRole(role?: string): GbpAdminRole {
  switch (role) {
    case "PRIMARY_OWNER":
    case "OWNER":
    case "MANAGER":
    case "SITE_MANAGER":
    case "ADMIN_ROLE_UNSPECIFIED":
      return role;
    default:
      return "UNKNOWN";
  }
}

function isManagerRole(role: GbpAdminRole): boolean {
  return role === "PRIMARY_OWNER" || role === "OWNER" || role === "MANAGER";
}

function parseAdminRecord(
  record: AdminApiRecord,
  source: "location" | "account"
): GbpAdminRecord {
  const admin = record.admin?.trim() ?? "";
  const isEmail = admin.includes("@");

  return {
    email: isEmail ? admin : undefined,
    displayName: isEmail ? undefined : admin || undefined,
    role: parseAdminRole(record.role),
    pendingInvitation: Boolean(record.pendingInvitation),
    source,
  };
}

export async function getGoogleTokenEmail(accessToken: string): Promise<string | undefined> {
  const res = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return undefined;

  const data = (await res.json()) as { email?: string };
  return normalizeEmail(data.email);
}

async function resolveGoogleAccountEmail(
  connection: GbpConnection
): Promise<string | undefined> {
  return (
    normalizeEmail(connection.googleEmail) ??
    (await getGoogleTokenEmail(connection.accessToken))
  );
}

async function listAdmins(
  connection: GbpConnection,
  parent: string
): Promise<{ admins: GbpAdminRecord[]; denied: boolean }> {
  const res = await fetch(`${ACCOUNT_MANAGEMENT_BASE}/${parent}/admins`, {
    headers: authHeadersForConnection(connection),
  });

  const data = (await res.json()) as {
    admins?: AdminApiRecord[];
    error?: { message?: string };
  };

  if (res.status === 403) {
    return { admins: [], denied: true };
  }

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Failed to list admins (${res.status})`);
  }

  const source = parent.startsWith("locations/") ? "location" : "account";
  return {
    admins: (data.admins ?? []).map((admin) => parseAdminRecord(admin, source)),
    denied: false,
  };
}

function findMatchingAdmin(
  admins: GbpAdminRecord[],
  googleAccountEmail?: string
): GbpAdminRecord | undefined {
  if (!googleAccountEmail) return undefined;

  return admins.find((admin) => admin.email?.toLowerCase() === googleAccountEmail);
}

function withLegacyEmail<T extends GbpLocationAccessCheck>(check: T): T {
  return { ...check, connectedEmail: check.googleAccountEmail };
}

function buildAccessGuidance(input: {
  status: GbpAccessStatus;
  googleAccountEmail?: string;
  platformEmail?: string;
  accountMismatch: boolean;
  matchedRole?: GbpAdminRole;
  performanceDenied: boolean;
}): Pick<GbpLocationAccessCheck, "headline" | "detail" | "suggestion" | "severity"> {
  const {
    status,
    googleAccountEmail,
    platformEmail,
    accountMismatch,
    matchedRole,
    performanceDenied,
  } = input;

  if (accountMismatch && performanceDenied) {
    return {
      severity: "warning",
      headline: "Google Business Profile is connected to a different account",
      detail: platformEmail
        ? `You're signed in to Reputation Boost as ${platformEmail}, but GBP access was authorized via ${googleAccountEmail ?? "another Google account"}. These are separate logins.`
        : `GBP access was authorized via ${googleAccountEmail ?? "a Google account"} that may not be the one you intended.`,
      suggestion: platformEmail
        ? `Click Reconnect GBP and choose ${platformEmail} when Google asks which account to use. Sign out of Google first if you keep seeing the wrong account.`
        : "Reconnect GBP and choose the Google account that is Owner or Manager on this business.",
    };
  }

  if (status === "confirmed_manager" && performanceDenied) {
    return {
      severity: "info",
      headline: "Performance insights not available for this location",
      detail: googleAccountEmail
        ? `GBP is authorized via ${googleAccountEmail} (${matchedRole?.replace(/_/g, " ").toLowerCase()} access), but Google is not returning call and view metrics.`
        : "Your connected Google account has Manager access, but Google is not returning call and view metrics for this location.",
      suggestion:
        "This is a known Google limitation for some listings. Your audit will continue using profile, review, and ranking data.",
    };
  }

  if (status === "site_manager_only") {
    return {
      severity: "warning",
      headline: "Performance metrics need a higher access level",
      detail: googleAccountEmail
        ? `GBP is authorized via ${googleAccountEmail} as Site Manager, which cannot read performance insights.`
        : "The connected Google account has Site Manager access, which cannot read performance insights.",
      suggestion:
        "Reconnect GBP with a Google account that is Owner or Manager on this Business Profile location.",
    };
  }

  if (status === "no_admin_match") {
    return {
      severity: "warning",
      headline: "Connected Google account may not manage this location",
      detail: googleAccountEmail
        ? `GBP is authorized via ${googleAccountEmail}, but that account is not listed as an Owner or Manager on this location.`
        : "The Google account used for GBP access is not listed as an Owner or Manager on this location.",
      suggestion:
        "Reconnect GBP with the Google account that manages this business in Google Business Profile.",
    };
  }

  if (status === "cannot_list_admins") {
    return {
      severity: "warning",
      headline: "Unable to verify Business Profile access",
      detail: googleAccountEmail
        ? `Google would not let ${googleAccountEmail} list administrators for this location.`
        : "Google would not let the connected account list administrators for this location.",
      suggestion:
        "Reconnect GBP with an Owner or Manager Google account for this location, then re-run the audit.",
    };
  }

  return {
    severity: "warning",
    headline: "Performance metrics unavailable",
    detail: googleAccountEmail
      ? `GBP is authorized via ${googleAccountEmail}, but Google returned permission denied for calls, profile views, and direction clicks.`
      : "Google returned permission denied for calls, profile views, and direction clicks.",
    suggestion:
      "Open Settings to review which Google account is connected, then reconnect with an Owner or Manager account if needed.",
  };
}

export async function checkGbpLocationAccess(
  connection: GbpConnection,
  options?: {
    platformEmail?: string;
    performanceDenied?: boolean;
  }
): Promise<GbpLocationAccessCheck> {
  const performanceDenied = options?.performanceDenied ?? false;
  const googleAccountEmail = await resolveGoogleAccountEmail(connection);
  const platformEmail = normalizeEmail(options?.platformEmail);
  const accountMismatch = Boolean(
    platformEmail && googleAccountEmail && platformEmail !== googleAccountEmail
  );

  if (accountMismatch && performanceDenied) {
    const guidance = buildAccessGuidance({
      status: "account_mismatch",
      googleAccountEmail,
      platformEmail,
      accountMismatch: true,
      performanceDenied,
    });
    return withLegacyEmail({
      status: "account_mismatch",
      googleAccountEmail,
      platformEmail,
      accountMismatch: true,
      admins: [],
      ...guidance,
    });
  }

  const locationId = normalizeLocationId(connection.locationId);
  const accountId = normalizeAccountId(connection.accountId);

  let admins: GbpAdminRecord[] = [];
  let denied = false;

  try {
    const locationResult = await listAdmins(connection, `locations/${locationId}`);
    admins = locationResult.admins;
    denied = locationResult.denied;

    if (!denied) {
      const accountResult = await listAdmins(connection, `accounts/${accountId}`);
      admins = [...admins, ...accountResult.admins];
    }
  } catch {
    const guidance = buildAccessGuidance({
      status: "check_failed",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      performanceDenied,
    });
    return withLegacyEmail({
      status: "check_failed",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      admins: [],
      ...guidance,
    });
  }

  if (denied) {
    const guidance = buildAccessGuidance({
      status: "cannot_list_admins",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      performanceDenied,
    });
    return withLegacyEmail({
      status: "cannot_list_admins",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      admins: [],
      ...guidance,
    });
  }

  const match = findMatchingAdmin(admins, googleAccountEmail);
  const managerMatch = match && isManagerRole(match.role) ? match : undefined;
  const siteManagerMatch = match?.role === "SITE_MANAGER" ? match : undefined;

  if (managerMatch) {
    const guidance = buildAccessGuidance({
      status: "confirmed_manager",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      matchedRole: managerMatch.role,
      performanceDenied,
    });
    return withLegacyEmail({
      status: "confirmed_manager",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      matchedRole: managerMatch.role,
      admins,
      ...guidance,
    });
  }

  if (siteManagerMatch) {
    const guidance = buildAccessGuidance({
      status: "site_manager_only",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      matchedRole: siteManagerMatch.role,
      performanceDenied,
    });
    return withLegacyEmail({
      status: "site_manager_only",
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      matchedRole: siteManagerMatch.role,
      admins,
      ...guidance,
    });
  }

  const guidance = buildAccessGuidance({
    status: "no_admin_match",
    googleAccountEmail,
    platformEmail,
    accountMismatch,
    performanceDenied,
  });
  return withLegacyEmail({
    status: "no_admin_match",
    googleAccountEmail,
    platformEmail,
    accountMismatch,
    admins,
    ...guidance,
  });
}
