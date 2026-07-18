/**
 * Plan tab Definition of 9.0 — acceptance criteria closed by J1–J6.
 * Automated coverage lives in plan-proof-pack.test.ts; soak is manual.
 */
export const PLAN_DEFINITION_OF_NINE = [
  {
    id: "J1",
    title: "Selective reconcile",
    criterion:
      "Curated merge plans do not grow into a full checklist on reconcile (forced classes only).",
  },
  {
    id: "J2",
    title: "Mixed-stack dampening",
    criterion:
      "Mixed rank+conversion stacked $/leads is strictly dampened vs the isolated sum.",
  },
  {
    id: "J3",
    title: "First-class leads",
    criterion:
      "Without ACV: leads/mo on steps + header; with ACV: $/mo — no silent blanks for material steps.",
  },
  {
    id: "J4",
    title: "Conversion engagement signal",
    criterion:
      "Conversion steps show a truthful engagement signal (actions/leads), not 0 ranking pts.",
  },
  {
    id: "J5",
    title: "Plan↔Results deep-link",
    criterion: "See results never hangs focus when the changelog row is missing.",
  },
  {
    id: "J6",
    title: "Proof pack",
    criterion: "Regression suite covers J1–J5 findings; one live soak checklist passes.",
  },
] as const;

/** Manual soak on one live business after J1–J5 land on main. */
export const PLAN_SOAK_CHECKLIST = [
  "No ACV → steps + header show leads/mo; NBA order is sensible",
  "Set ACV in Settings → open Plan → $/mo appears and step order still makes sense",
  "Curated plan → Refresh Plan → step count does not explode into the full checklist",
  "Publish a conversion step → See results deep-link works (or miss notice + focus clears)",
  "Stack two high-impact steps → stacked estimate is below the sum of isolated card impacts",
] as const;
