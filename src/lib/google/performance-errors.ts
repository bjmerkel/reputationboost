export const PERFORMANCE_API_ENABLE_URL =
  "https://console.cloud.google.com/apis/library/businessprofileperformance.googleapis.com";

export const GBP_API_ACCESS_FORM_URL =
  "https://developers.google.com/my-business/content/prereqs#request-access";

export function isPerformancePermissionError(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("does not have permission") ||
    lower.includes("permission denied") ||
    lower.includes("caller does not have") ||
    lower.includes("403")
  );
}

export function performanceSetupSteps(): string[] {
  return [
    "Open Google Cloud Console for the same project as your GOOGLE_CLIENT_ID OAuth app.",
    `Enable the Business Profile Performance API: ${PERFORMANCE_API_ENABLE_URL}`,
    "Confirm GBP API access is approved — quota should be 300 QPM (not 0) under APIs & Services → Enabled APIs → quotas.",
    "If quota is 0, submit the GBP API access form: https://developers.google.com/my-business/content/prereqs",
    "Use a Google account that is Owner or Manager on the Business Profile location.",
    "Some locations return permission denied even when the API is enabled — verify the location in GBP dashboard.",
    "If on Google Workspace, ensure Google Business Profile is enabled for your organization.",
    "Disconnect and reconnect GBP in Settings to refresh OAuth after enabling the API.",
  ];
}

export function formatPerformanceError(error: unknown, httpStatus?: number): string {
  const raw = error instanceof Error ? error.message : String(error);

  if (isPerformancePermissionError(raw) || httpStatus === 403) {
    return "Call clicks and profile views aren't available for this location right now.";
  }

  if (httpStatus === 404) {
    return "This Google Business Profile location could not be found. Try reconnecting in Settings.";
  }

  return "Google insights are temporarily unavailable.";
}
