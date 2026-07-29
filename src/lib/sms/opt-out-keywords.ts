const OPT_OUT_KEYWORDS = new Set([
  "stop",
  "stopall",
  "unsubscribe",
  "cancel",
  "end",
  "quit",
]);

const OPT_IN_KEYWORDS = new Set(["start", "unstop", "yes"]);

export type SmsPreferenceReply = "opt_out" | "opt_in" | null;

export function parseSmsPreferenceReply(body: string): SmsPreferenceReply {
  const normalized = body.trim().toLowerCase();
  if (!normalized) return null;

  const firstToken = normalized.split(/\s+/)[0]?.replace(/[^\w]/g, "") ?? "";
  if (OPT_OUT_KEYWORDS.has(firstToken)) return "opt_out";
  if (OPT_IN_KEYWORDS.has(firstToken)) return "opt_in";
  return null;
}
