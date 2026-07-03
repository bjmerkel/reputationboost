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
  | "check_failed";

export interface GbpLocationAccessCheck {
  status: GbpAccessStatus;
  connectedEmail?: string;
  matchedRole?: GbpAdminRole;
  admins: GbpAdminRecord[];
  headline: string;
  detail: string;
  suggestion: string;
  severity: "info" | "warning";
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
  return data.email?.toLowerCase();
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
  connectedEmail?: string
): GbpAdminRecord | undefined {
  if (!connectedEmail) return undefined;
  const email = connectedEmail.toLowerCase();

  return admins.find((admin) => admin.email?.toLowerCase() === email);
}

function buildAccessGuidance(input: {
  status: GbpAccessStatus;
  connectedEmail?: string;
  matchedRole?: GbpAdminRole;
  performanceDenied: boolean;
}): Pick<GbpLocationAccessCheck, "headline" | "detail" | "suggestion" | "severity"> {
  const { status, connectedEmail, matchedRole, performanceDenied } = input;

  if (status === "confirmed_manager" && performanceDenied) {
    return {
      severity: "info",
      headline: "Performance insights not available for this location",
      detail: connectedEmail
        ? `${connectedEmail} has ${matchedRole?.replace(/_/g, " ").toLowerCase()} access on this profile, but Google is not returning call and view metrics.`
        : "Your connected account has Manager access, but Google is not returning call and view metrics for this location.",
      suggestion:
        "This is a known Google limitation for some listings. Your audit will continue using profile, review, and ranking data. Try reconnecting in Settings if the location was recently transferred or verified.",
    };
  }

  if (status === "site_manager_only") {
    return {
      severity: "warning",
      headline: "Performance metrics need a higher access level",
      detail: connectedEmail
        ? `${connectedEmail} is connected as Site Manager, which cannot read performance insights.`
        : "The connected Google account has Site Manager access, which cannot read performance insights.",
      suggestion:
        "Reconnect with a Google account that is Owner or Manager on this Business Profile location.",
    };
  }

  if (status === "no_admin_match") {
    return {
      severity: "warning",
      headline: "Connected account may not manage this location",
      detail: connectedEmail
        ? `We could not match ${connectedEmail} to an Owner or Manager on this location.`
        : "We could not match the connected Google account to an Owner or Manager on this location.",
      suggestion:
        "Reconnect Google Business Profile using an account listed as Owner or Manager in Google Business Profile.",
    };
  }

  if (status === "cannot_list_admins") {
    return {
      severity: "warning",
      headline: "Unable to verify Business Profile access",
      detail:
        "Google would not let us list administrators for this location using the connected account.",
      suggestion:
        "Reconnect with a Google account that is Owner or Manager on this location, then re-run the audit.",
    };
  }

  return {
    severity: "warning",
    headline: "Performance metrics unavailable",
    detail:
      "Google returned permission denied for calls, profile views, and direction clicks.",
    suggestion:
      "Check Settings for access details, then reconnect with an Owner or Manager account if needed.",
  };
}

export async function checkGbpLocationAccess(
  connection: GbpConnection,
  options?: { connectedEmail?: string; performanceDenied?: boolean }
): Promise<GbpLocationAccessCheck> {
  const performanceDenied = options?.performanceDenied ?? false;
  const connectedEmail =
    (await getGoogleTokenEmail(connection.accessToken)) ?? options?.connectedEmail?.toLowerCase();

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
      connectedEmail,
      performanceDenied,
    });
    return {
      status: "check_failed",
      connectedEmail,
      admins: [],
      ...guidance,
    };
  }

  if (denied) {
    const guidance = buildAccessGuidance({
      status: "cannot_list_admins",
      connectedEmail,
      performanceDenied,
    });
    return {
      status: "cannot_list_admins",
      connectedEmail,
      admins: [],
      ...guidance,
    };
  }

  const match = findMatchingAdmin(admins, connectedEmail);
  const managerMatch = match && isManagerRole(match.role) ? match : undefined;
  const siteManagerMatch = match?.role === "SITE_MANAGER" ? match : undefined;

  if (managerMatch) {
    const guidance = buildAccessGuidance({
      status: "confirmed_manager",
      connectedEmail,
      matchedRole: managerMatch.role,
      performanceDenied,
    });
    return {
      status: "confirmed_manager",
      connectedEmail,
      matchedRole: managerMatch.role,
      admins,
      ...guidance,
    };
  }

  if (siteManagerMatch) {
    const guidance = buildAccessGuidance({
      status: "site_manager_only",
      connectedEmail,
      matchedRole: siteManagerMatch.role,
      performanceDenied,
    });
    return {
      status: "site_manager_only",
      connectedEmail,
      matchedRole: siteManagerMatch.role,
      admins,
      ...guidance,
    };
  }

  const guidance = buildAccessGuidance({
    status: "no_admin_match",
    connectedEmail,
    performanceDenied,
  });
  return {
    status: "no_admin_match",
    connectedEmail,
    admins,
    ...guidance,
  };
}
