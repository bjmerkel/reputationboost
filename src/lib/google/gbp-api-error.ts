interface GbpErrorDetail {
  "@type"?: string;
  reason?: string;
  errorCode?: string;
  metadata?: Record<string, string>;
  fieldViolations?: Array<{ field?: string; description?: string }>;
}

interface GbpApiErrorBody {
  error?: {
    message?: string;
    status?: string;
    details?: GbpErrorDetail[];
  };
}

const ERROR_MESSAGES: Record<string, (metadata?: Record<string, string>) => string> = {
  PROFILE_DESCRIPTION_CONTAINS_URL:
    () =>
      "Google does not allow URLs in the business description. Remove website links and publish again.",
  LODGING_CANNOT_EDIT_PROFILE_DESCRIPTION:
    () => "Lodging businesses cannot edit the profile description through the API.",
  STALE_DATA:
    () =>
      "Google recently changed your profile. Resolve the description conflict in Take Action (Google Updates) before publishing a new description.",
  FORBIDDEN_WORDS: (metadata) => {
    const words = metadata?.forbidden_words;
    return words
      ? `Google rejected forbidden words in the description: ${words}. Edit the text and try again.`
      : "Google rejected forbidden words in the description. Edit the text and try again.";
  },
  INVALID_CHARACTERS: (metadata) => {
    const chars = metadata?.invalid_characters;
    return chars
      ? `Google rejected invalid characters in the description: ${chars}. Edit the text and try again.`
      : "Google rejected invalid characters in the description. Edit the text and try again.";
  },
  INVALID_INTERCHANGE_CHARACTERS:
    () => "Google rejected special formatting characters in the description. Use plain text only.",
  STRING_TOO_LONG: (metadata) => {
    const max = metadata?.max_length;
    return max
      ? `Description is too long. Google allows at most ${max} characters.`
      : "Description is too long for Google Business Profile.";
  },
  STRING_TOO_SHORT: (metadata) => {
    const min = metadata?.min_length;
    return min
      ? `Description is too short. Google requires at least ${min} characters.`
      : "Description is too short for Google Business Profile.";
  },
  THROTTLED:
    () => "Google is temporarily blocking description updates. Try again in a few hours.",
  INVALID_SERVICE_ITEM:
    () => "A service entry was malformed (missing structured or free-form data). Refresh and try again.",
  SERVICE_ITEM_LABEL_NO_DISPLAY_NAME:
    () => "A service is missing its name. Give every service a display name and republish.",
  SERVICE_ITEM_LABEL_DUPLICATE_DISPLAY_NAME:
    () =>
      "Two services have the same name. Service names must be unique — rename the duplicate and republish.",
  SERVICE_ITEM_LABEL_INVALID_UTF8:
    () => "A service name or description contains unsupported characters. Use plain text and republish.",
  FREE_FORM_SERVICE_ITEM_WITH_NO_CATEGORY_ID:
    () => "A custom service is missing its category. Set a primary category and republish.",
  FREE_FORM_SERVICE_ITEM_WITH_NO_LABEL:
    () => "A custom service is missing its name and description. Fill them in and republish.",
  SERVICE_ITEM_WITH_NO_SERVICE_TYPE_ID:
    () => "A structured service is missing its Google service type. Refresh and try again.",
  SERVICE_TYPE_ID_DUPLICATE:
    () => "The same Google service type is listed twice. Remove the duplicate service and republish.",
  PRICE_CURRENCY_MISSING:
    () => "A service price is missing its currency. Add a currency (e.g. USD) or remove the price.",
  PRICE_CURRENCY_INVALID:
    () => "A service price has an invalid currency code. Use an ISO code like USD.",
};

function extractErrorCode(detail: GbpErrorDetail): string | null {
  if (detail.errorCode) return detail.errorCode;
  if (detail.reason && ERROR_MESSAGES[detail.reason]) return detail.reason;
  return null;
}

/** Turn a Google Business Information API error body into a user-facing message. */
export function formatGbpApiError(data: GbpApiErrorBody, fallbackStatus?: number): string {
  const error = data.error;
  if (!error) {
    return fallbackStatus ? `GBP update failed (${fallbackStatus})` : "GBP update failed";
  }

  for (const detail of error.details ?? []) {
    const code = extractErrorCode(detail);
    if (code && ERROR_MESSAGES[code]) {
      return ERROR_MESSAGES[code](detail.metadata);
    }

    const violation = detail.fieldViolations?.find((v) => v.description?.trim());
    if (violation?.description) {
      return violation.description;
    }
  }

  const message = error.message?.trim();
  if (message && message !== "Request contains an invalid argument.") {
    return message;
  }

  return "Google rejected the update (invalid argument). Use plain text only — no URLs, HTML, or phone numbers — keep within the field's length limit, and resolve any pending conflicts in Take Action → Google Updates.";
}
