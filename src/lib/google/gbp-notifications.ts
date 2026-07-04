import type { GbpConnection } from "@/audit/types";
import { authHeadersForConnection } from "./auth-headers";

const NOTIFICATIONS_BASE = "https://mybusinessnotifications.googleapis.com/v1";

export type GbpNotificationType =
  | "NOTIFICATION_TYPE_UNSPECIFIED"
  | "GOOGLE_UPDATE"
  | "NEW_REVIEW"
  | "UPDATED_REVIEW"
  | "NEW_CUSTOMER_MEDIA"
  | "NEW_QUESTION"
  | "UPDATED_QUESTION"
  | "NEW_ANSWER"
  | "UPDATED_ANSWER"
  | "DUPLICATE_LOCATION"
  | "LOSS_OF_VOICE_OF_MERCHANT"
  | "VOICE_OF_MERCHANT_UPDATED";

export interface GbpNotificationSetting {
  name: string;
  pubsubTopic: string;
  notificationTypes: GbpNotificationType[];
}

/** Active notification types worth subscribing to (excludes deprecated Q&A types). */
export const RECOMMENDED_NOTIFICATION_TYPES: GbpNotificationType[] = [
  "GOOGLE_UPDATE",
  "NEW_REVIEW",
  "UPDATED_REVIEW",
  "NEW_CUSTOMER_MEDIA",
  "DUPLICATE_LOCATION",
  "VOICE_OF_MERCHANT_UPDATED",
];

export const DEPRECATED_NOTIFICATION_TYPES = new Set<GbpNotificationType>([
  "NEW_QUESTION",
  "UPDATED_QUESTION",
  "NEW_ANSWER",
  "UPDATED_ANSWER",
  "LOSS_OF_VOICE_OF_MERCHANT",
]);

const NOTIFICATION_TYPE_LABELS: Record<GbpNotificationType, string> = {
  NOTIFICATION_TYPE_UNSPECIFIED: "Unspecified",
  GOOGLE_UPDATE: "Google suggested edits",
  NEW_REVIEW: "New reviews",
  UPDATED_REVIEW: "Updated reviews",
  NEW_CUSTOMER_MEDIA: "Customer photos & videos",
  NEW_QUESTION: "New Q&A (deprecated)",
  UPDATED_QUESTION: "Updated Q&A (deprecated)",
  NEW_ANSWER: "New Q&A answers (deprecated)",
  UPDATED_ANSWER: "Updated Q&A answers (deprecated)",
  DUPLICATE_LOCATION: "Duplicate location flags",
  LOSS_OF_VOICE_OF_MERCHANT: "Voice of Merchant loss (deprecated)",
  VOICE_OF_MERCHANT_UPDATED: "Voice of Merchant status",
};

export function notificationTypeLabel(type: GbpNotificationType): string {
  return NOTIFICATION_TYPE_LABELS[type] ?? type;
}

export function getGbpPubsubTopic(): string | undefined {
  const topic = process.env.GBP_PUBSUB_TOPIC?.trim();
  return topic || undefined;
}

function notificationSettingName(connection: GbpConnection): string {
  const accountId = connection.accountId.replace(/^accounts\//, "");
  return `accounts/${accountId}/notificationSetting`;
}

function normalizeNotificationSetting(
  data: Partial<GbpNotificationSetting>,
  connection: GbpConnection
): GbpNotificationSetting {
  return {
    name: data.name ?? notificationSettingName(connection),
    pubsubTopic: data.pubsubTopic ?? "",
    notificationTypes: (data.notificationTypes ?? []) as GbpNotificationType[],
  };
}

/** accounts.getNotificationSetting */
export async function getGbpNotificationSetting(
  connection: GbpConnection
): Promise<GbpNotificationSetting | null> {
  const name = notificationSettingName(connection);
  const url = `${NOTIFICATIONS_BASE}/${name}`;

  const res = await fetch(url, {
    headers: authHeadersForConnection(connection),
  });

  if (res.status === 404) {
    return null;
  }

  const data = (await res.json()) as Partial<GbpNotificationSetting> & {
    error?: { message?: string };
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Notification settings fetch failed (${res.status})`);
  }

  return normalizeNotificationSetting(data, connection);
}

/** accounts.updateNotificationSetting */
export async function updateGbpNotificationSetting(
  connection: GbpConnection,
  options: {
    pubsubTopic?: string;
    notificationTypes?: GbpNotificationType[];
  }
): Promise<GbpNotificationSetting> {
  const current = await getGbpNotificationSetting(connection);
  const name = notificationSettingName(connection);

  const body: GbpNotificationSetting = {
    name,
    pubsubTopic: options.pubsubTopic ?? current?.pubsubTopic ?? "",
    notificationTypes: options.notificationTypes ?? current?.notificationTypes ?? [],
  };

  const url = new URL(`${NOTIFICATIONS_BASE}/${name}`);
  url.searchParams.set("updateMask", "notificationSetting");

  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: {
      ...authHeadersForConnection(connection),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ notificationSetting: body }),
  });

  const data = (await res.json()) as Partial<GbpNotificationSetting> & {
    error?: { message?: string };
    notificationSetting?: Partial<GbpNotificationSetting>;
  };

  if (!res.ok) {
    throw new Error(data.error?.message ?? `Notification settings update failed (${res.status})`);
  }

  const resolved = data.notificationSetting ?? data;
  return normalizeNotificationSetting(resolved, connection);
}

/** Enable recommended Pub/Sub alerts when GBP_PUBSUB_TOPIC is configured. */
export async function ensureGbpNotificationSetting(
  connection: GbpConnection
): Promise<GbpNotificationSetting | null> {
  const topic = getGbpPubsubTopic();
  if (!topic) return null;

  const current = await getGbpNotificationSetting(connection);
  const enabled = new Set(current?.notificationTypes ?? []);

  for (const type of RECOMMENDED_NOTIFICATION_TYPES) {
    enabled.add(type);
  }

  const deprecated = [...enabled].filter((type) => DEPRECATED_NOTIFICATION_TYPES.has(type));
  for (const type of deprecated) {
    enabled.delete(type);
  }

  const notificationTypes = [...enabled];
  const alreadyConfigured =
    current?.pubsubTopic === topic &&
    RECOMMENDED_NOTIFICATION_TYPES.every((type) => notificationTypes.includes(type));

  if (alreadyConfigured) {
    return current;
  }

  return updateGbpNotificationSetting(connection, {
    pubsubTopic: topic,
    notificationTypes,
  });
}

/** Remove deprecated types and enable any missing recommended subscriptions. */
export async function syncRecommendedGbpNotifications(
  connection: GbpConnection,
  pubsubTopic?: string
): Promise<GbpNotificationSetting> {
  const topic = pubsubTopic ?? getGbpPubsubTopic();
  if (!topic) {
    throw new Error(
      "GBP_PUBSUB_TOPIC is not configured. Set it to your Google Cloud Pub/Sub topic resource name."
    );
  }

  const current = await getGbpNotificationSetting(connection);
  const enabled = new Set(current?.notificationTypes ?? []);

  for (const type of RECOMMENDED_NOTIFICATION_TYPES) {
    enabled.add(type);
  }
  for (const type of DEPRECATED_NOTIFICATION_TYPES) {
    enabled.delete(type as GbpNotificationType);
  }

  return updateGbpNotificationSetting(connection, {
    pubsubTopic: topic,
    notificationTypes: [...enabled],
  });
}

/** Disable all Pub/Sub notifications for the account. */
export async function clearGbpNotificationSetting(
  connection: GbpConnection
): Promise<GbpNotificationSetting> {
  return updateGbpNotificationSetting(connection, {
    pubsubTopic: "",
    notificationTypes: [],
  });
}
