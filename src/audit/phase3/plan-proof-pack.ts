/**
 * Plan tab Definition of 9.0 — acceptance criteria closed by J1–J6 (product polish)
 * and R1–R6 (revenue effectiveness). Automated coverage lives in plan-proof-pack.test.ts;
 * soak is manual.
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
  {
    id: "R1",
    title: "Keyword action binding",
    criterion:
      "Step primaryKeyword ∈ keywordsTargetedByStep; Keyword Priority deep-link opens the best unfinished bound step (not first list match).",
  },
  {
    id: "R2",
    title: "Weak conversion rate",
    criterion:
      "Weak actionRate (<3%) triggers conversion boost; when pack share ≥50%, NBA overweights steps 8/11/13/15.",
  },
  {
    id: "R3",
    title: "Calibrated engagement estimates",
    criterion:
      "Engagement projections blend attribution when sample ≥ 2; UI labels model vs calibrated estimates.",
  },
  {
    id: "R4",
    title: "Media coverage over volume",
    criterion:
      "Photo/video satisfaction uses coverage (not arbitrary counts); media does not outrank conversion when pack held + weak CTR.",
  },
  {
    id: "R5",
    title: "Batch approve = impact order",
    criterion:
      "Pending batch/routine approve order follows revenue→leads→engagement impact, not raw step number.",
  },
  {
    id: "R6",
    title: "Keyword playbooks + soak gate",
    criterion:
      "Top keywords expose one primary CTA playbook; custom steps show qualitative signal; live soak checklist passes.",
  },
] as const;

/** Manual soak on one live business after polish + revenue criteria land on main. */
export const PLAN_SOAK_CHECKLIST = [
  "No ACV → steps + header show leads/mo; NBA order is sensible",
  "Set ACV in Settings → open Plan → $/mo appears and step order still makes sense",
  "Curated plan → Refresh Plan → step count does not explode into the full checklist",
  "Publish a conversion step → See results deep-link works (or miss notice + focus clears)",
  "Stack two high-impact steps → stacked estimate is below the sum of isolated card impacts",
  "Win these searches CTA opens the bound step for that keyword (not a random early card)",
  "In-pack business with low action rate → NBA leads with place actions / CTA posts / replies",
  "After several attributed publishes → step impact drops 'model' wording when confidence rises",
  "Business with 40+ photos + weak CTR → Photos is not the top NBA item",
  "Batch approve modal opens highest-impact pending task first",
  "Custom strategist step shows qualitative signal (not a blank impact row)",
  "First Plan viewport reads: progress → NBA → keyword playbooks (checklist below)",
] as const;
