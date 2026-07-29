export type OutreachChannel = "sms" | "email" | "auto";

export function channelLabel(channel: OutreachChannel): string {
  switch (channel) {
    case "email":
      return "Email";
    case "auto":
      return "Smart";
    default:
      return "SMS";
  }
}

export function channelDescription(channel: OutreachChannel): string {
  switch (channel) {
    case "email":
      return "Send polished review request emails to customers with an email on file.";
    case "auto":
      return "Email when available, otherwise SMS — reach every customer with one click.";
    default:
      return "Send personalized text messages asking for Google reviews.";
  }
}
