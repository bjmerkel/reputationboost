import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";
import { getGbpLocationProfile } from "./gbp-location";

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
  | "check_failed";

export interface GbpLocationAccessCheck {
  status: GbpAccessStatus;
  /** Google account authorized for GBP OAuth — not the Reputation Boost sign-in. */
  googleAccountEmail?: string;
  /** Supabase / app sign-in email, when provided. */
  platformEmail?: string;
  /** Platform sign-in differs from GBP OAuth — not a problem when GBP account has manager access. */
  accountMismatch: boolean;
  /** GBP OAuth account has verified manager-level access on this location. */
  gbpAccessVerified: boolean;
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
  const userinfoRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (userinfoRes.ok) {
    const userinfo = (await userinfoRes.json()) as { email?: string };
    const fromUserinfo = normalizeEmail(userinfo.email);
    if (fromUserinfo) return fromUserinfo;
  }

  const res = await fetch(
    `https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) return undefined;

  const data = (await res.json()) as { email?: string };
  return normalizeEmail(data.email);
}

export async function resolveGoogleAccountEmail(
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

async function canReadLocationProfile(connection: GbpConnection): Promise<boolean> {
  try {
    await getGbpLocationProfile(connection);
    return true;
  } catch {
    return false;
  }
}

function confirmedManagerCheck(
  input: {
    googleAccountEmail?: string;
    platformEmail?: string;
    accountMismatch: boolean;
    matchedRole?: GbpAdminRole;
    performanceDenied: boolean;
    admins: GbpAdminRecord[];
  }
): GbpLocationAccessCheck {
  const role = input.matchedRole ?? "MANAGER";
  const guidance = buildAccessGuidance({
    status: "confirmed_manager",
    ...input,
    matchedRole: role,
  });
  return withLegacyEmail({
    status: "confirmed_manager",
    googleAccountEmail: input.googleAccountEmail,
    platformEmail: input.platformEmail,
    accountMismatch: input.accountMismatch,
    gbpAccessVerified: true,
    matchedRole: role,
    admins: input.admins,
    ...guidance,
  });
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
    performanceDenied,
  } = input;

  if (status === "confirmed_manager" && performanceDenied) {
    return {
      severity: "info",
      headline: "Call & view insights aren't available right now",
      detail:
        "Google isn't sharing call clicks, profile views, or direction requests for this location. Your profile details, reviews, and keyword rankings are still included in your audit.",
      suggestion:
        accountMismatch && platformEmail && googleAccountEmail
          ? `You sign in as ${platformEmail} and manage the profile through ${googleAccountEmail} — that's a normal setup. No changes needed.`
          : "Nothing you need to change — your Google Business Profile connection looks correct.",
    };
  }

  if (status === "confirmed_manager") {
    return {
      severity: "info",
      headline: "Profile connected",
      detail: "Your Google Business Profile is linked and ready.",
      suggestion: "",
    };
  }

  if (status === "site_manager_only") {
    return {
      severity: "warning",
      headline: "More access is needed for insights",
      detail:
        "The connected Google account has limited access and can't load call or view data.",
      suggestion:
        "Reconnect your Google Business Profile using an account with Owner or Manager access.",
    };
  }

  if (status === "no_admin_match" || status === "cannot_list_admins" || status === "check_failed") {
    return {
      severity: "warning",
      headline: "Couldn't verify Google Business Profile access",
      detail: googleAccountEmail
        ? `We're connected through ${googleAccountEmail}, but couldn't confirm full access to this location.`
        : "We couldn't confirm full access to this Google Business Profile location.",
      suggestion:
        "Try reconnecting your Google Business Profile in Settings. Use the Google account that manages this business.",
    };
  }

  return {
    severity: "warning",
    headline: "Insights temporarily unavailable",
    detail:
      "Call clicks and profile views aren't loading for this location right now.",
    suggestion: "Your audit will still include profile, review, and ranking data.",
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

  const locationId = normalizeLocationId(connection.locationId);
  const accountId = normalizeAccountId(connection.accountId);

  let admins: GbpAdminRecord[] = [];
  let locationAdminsDenied = false;

  try {
    const locationResult = await listAdmins(connection, `locations/${locationId}`);
    admins = locationResult.admins;
    locationAdminsDenied = locationResult.denied;

    if (!locationAdminsDenied) {
      const accountResult = await listAdmins(connection, `accounts/${accountId}`);
      admins = [...admins, ...accountResult.admins];
    }
  } catch {
    if (await canReadLocationProfile(connection)) {
      return confirmedManagerCheck({
        googleAccountEmail,
        platformEmail,
        accountMismatch,
        performanceDenied,
        admins: [],
      });
    }

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
      gbpAccessVerified: false,
      admins: [],
      ...guidance,
    });
  }

  if (locationAdminsDenied) {
    if (await canReadLocationProfile(connection)) {
      return confirmedManagerCheck({
        googleAccountEmail,
        platformEmail,
        accountMismatch,
        performanceDenied,
        admins: [],
      });
    }

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
      gbpAccessVerified: false,
      admins: [],
      ...guidance,
    });
  }

  const match = findMatchingAdmin(admins, googleAccountEmail);
  const managerMatch = match && isManagerRole(match.role) ? match : undefined;
  const siteManagerMatch = match?.role === "SITE_MANAGER" ? match : undefined;

  // Listing location admins succeeds → OAuth account has management access, even when
  // Google returns display names instead of emails in the admin list.
  const impliedManager = !managerMatch && !siteManagerMatch && !locationAdminsDenied;

  if (managerMatch || impliedManager) {
    return confirmedManagerCheck({
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      matchedRole: managerMatch?.role ?? "MANAGER",
      performanceDenied,
      admins,
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
      gbpAccessVerified: false,
      matchedRole: siteManagerMatch.role,
      admins,
      ...guidance,
    });
  }

  if (await canReadLocationProfile(connection)) {
    return confirmedManagerCheck({
      googleAccountEmail,
      platformEmail,
      accountMismatch,
      performanceDenied,
      admins,
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
    gbpAccessVerified: false,
    admins,
    ...guidance,
  });
}
