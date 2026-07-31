import {
  OUTREACH_MAX_RETRIES,
  OUTREACH_RETRY_DELAY_MINUTES,
} from "@/lib/review-requests/bulk-config";

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);

const RETRYABLE_ERROR_PATTERNS = [
  /rate limit/i,
  /too many requests/i,
  /timeout/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /internal server error/i,
  /ECONNRESET/i,
  /ETIMEDOUT/i,
];

export function isRetryableProviderError(error: string, statusCode?: number): boolean {
  if (statusCode !== undefined && RETRYABLE_STATUS_CODES.has(statusCode)) {
    return true;
  }

  const normalized = error.trim();
  if (!normalized) return false;

  return RETRYABLE_ERROR_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function nextRetryScheduledAt(retryCount: number): Date {
  const minutes = OUTREACH_RETRY_DELAY_MINUTES * Math.max(1, retryCount);
  return new Date(Date.now() + minutes * 60 * 1000);
}

export function shouldRetryOutreach(retryCount: number): boolean {
  return retryCount < OUTREACH_MAX_RETRIES;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
