import type { GbpNotificationSetting, GbpNotificationType } from "./gbp-notifications";
import {
  DEPRECATED_NOTIFICATION_TYPES,
  RECOMMENDED_NOTIFICATION_TYPES,
  notificationTypeLabel,
} from "./gbp-notifications";

export interface GbpNotificationCoverage {
  configured: boolean;
  pubsubTopic: string | null;
  enabledTypes: string[];
  missingRecommendedTypes: string[];
  deprecatedTypesEnabled: string[];
  coverageScore: number;
  hasReviewAlerts: boolean;
  hasGoogleUpdateAlerts: boolean;
  hasCustomerMediaAlerts: boolean;
  hasVoiceOfMerchantAlerts: boolean;
}

export function analyzeGbpNotificationCoverage(
  setting: GbpNotificationSetting | null
): GbpNotificationCoverage {
  const enabledTypes = (setting?.notificationTypes ?? []).map(String);
  const pubsubTopic = setting?.pubsubTopic?.trim() || null;
  const configured = Boolean(pubsubTopic && enabledTypes.length > 0);

  const missingRecommendedTypes = RECOMMENDED_NOTIFICATION_TYPES.filter(
    (type) => !enabledTypes.includes(type)
  ).map(String);

  const deprecatedTypesEnabled = enabledTypes.filter((type) =>
    DEPRECATED_NOTIFICATION_TYPES.has(type as GbpNotificationType)
  );

  const coverageScore = configured
    ? Math.round(
        ((RECOMMENDED_NOTIFICATION_TYPES.length - missingRecommendedTypes.length) /
          RECOMMENDED_NOTIFICATION_TYPES.length) *
          100
      )
    : 0;

  return {
    configured,
    pubsubTopic,
    enabledTypes,
    missingRecommendedTypes,
    deprecatedTypesEnabled,
    coverageScore,
    hasReviewAlerts:
      enabledTypes.includes("NEW_REVIEW") || enabledTypes.includes("UPDATED_REVIEW"),
    hasGoogleUpdateAlerts: enabledTypes.includes("GOOGLE_UPDATE"),
    hasCustomerMediaAlerts: enabledTypes.includes("NEW_CUSTOMER_MEDIA"),
    hasVoiceOfMerchantAlerts: enabledTypes.includes("VOICE_OF_MERCHANT_UPDATED"),
  };
}

export function formatEnabledNotificationSummary(enabledTypes: string[]): string {
  if (enabledTypes.length === 0) return "No event types subscribed";
  return enabledTypes
    .slice(0, 4)
    .map((type) => notificationTypeLabel(type as GbpNotificationType))
    .join(" · ");
}
