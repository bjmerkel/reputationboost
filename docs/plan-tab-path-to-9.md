# Plan Tab → 9/10: Ranking → Actions → Revenue

**Goal:** Make the Plan tab reliably optimize a Google Business Profile so target keywords rank higher in the local pack, convert more profile views into calls / directions / website clicks, and grow revenue.

**Baseline (code review):** ~6.5/10  
**Target:** ~9/10  
**Status:** Phases 0–4 implemented on this branch (see `plan-path-to-nine.test.ts` golden fixtures).  
**Not in scope for 9:** Perfect causal SEO science, multi-location franchise orchestration, or replacing Maps ranking with a black-box ML model.

---

## Success definition (what “9” means)

A business that follows Plan next-best actions for 30–60 days should see:

1. **Prioritization:** The top 3 Plan actions match the highest expected lift in calls+directions (or $/mo when ACV is set), not completeness busywork.
2. **Ranking honesty:** Projected rank/$ gains only appear when the step has a real mutation path *and* either calibrated evidence or a conservative, labeled heuristic.
3. **Conversion first when visible:** If pack share ≥ 50% and action rate is weak, NBA + `displayOrder` lead with place actions / CTA posts / attributes / review replies before photos/categories.
4. **Closed loop:** After ≥2 published attributions for a step type, Plan order and impact labels use blended real outcomes, not only model defaults.
5. **Keyword clarity:** Top money keywords each have one primary unfinished lever with a clear CTA into an executable step.
6. **UX:** First viewport answers “what do I do next for more calls/directions?” — score points are secondary.

---

## Scoreboard (how each phase moves the needle)

| Phase | Focus | Est. score after |
|-------|--------|------------------|
| 0 | Instrumentation + acceptance harness | 6.5 (no user-facing change) |
| 1 | Closed-loop ordering + conversion priority | ~7.5 |
| 2 | Ground rank/revenue claims + mutation integrity | ~8.2 |
| 3 | Effort-aware ROI + channel-specific conversion | ~8.6 |
| 4 | Plan UX for revenue outcomes + keyword coverage | ~9.0 |

---

## Phase 0 — Measurement harness (do first)

Without this, “9/10” is vibes.

### 0.1 Golden fixtures for Plan ordering

Add fixtures covering:

- Outside-pack, low impressions
- Outside-pack, high impressions + ACV
- In-pack ≥50%, views ≥100, action rate ~0%
- In-pack, healthy action rate, photo spam risk (40+ photos)
- Missing ACV / missing search keywords
- With attribution calibration `sampleSize ≥ 2` vs `0`

**Files:** new tests under `src/audit/phase2/*.test.ts`, `src/audit/phase3/plan-next-actions.test.ts`, `src/audit/phase2/gbp-plan.ts` consumers.

**Accept:** Assert ordered top-3 step numbers for each fixture; fail CI if conversion-first cases put photos/categories above 8/11/13/15.

### 0.2 Outcome metrics on Results ↔ Plan

Ensure each published plan step records:

- step number, keyword targets
- pre/post: pack position (where available), profile views, calls, directions, website clicks
- attribution window already used by Results

**Accept:** Calibration input coverage ≥ the step families we reorder on (at least 3, 4, 5, 8, 10, 11, 13, 15).

---

## Phase 1 — Closed loop + conversion priority (~7.5)

Highest leverage for real revenue. Ship before prettier UX.

### 1.1 Wire attribution into Plan `displayOrder`

**Problem:** `planStepImpactScore` / `orderGbpPlanStepsByImpact` ignore calibration; only NBA labels / Path-to-Healthy use it.

**Change:**

```ts
// gbp-plan.ts — pass calibration through
planStepImpactScore(audit, stepNumber, avgCustomerValue, calibration?)
orderGbpPlanStepsByImpact(audit, steps, avgCustomerValue, calibration?)
```

Use existing `estimateStepRevenueImpact` / `estimateStepLeadsImpact` / `estimateStepEngagementImpact` / `estimateStepOutcomeImpact` with calibration (already supported in `score-impact.ts`). Thread calibration from:

- strategy generation (`src/lib/llm/strategy.ts` / `gbp-plan-merge.ts`)
- reconcile (`src/audit/phase3/reconcile-plan.ts` → `refreshGbpPlanForReconcile`)
- `buildPlan` so UI order matches stored `displayOrder`

**Accept:**

- With `sampleSize ≥ 2` showing place-action engagement >> posts, step 15 outranks step 8 in `displayOrder` when both unfinished and conversion mode is on.
- Without calibration, order stays deterministic and matches today’s fixtures.

### 1.2 Promote conversion gaps when visibility is already won

**Problem:** `low-profile-conversions` / `weak-profile-conversions` are P2 in `gaps.ts`, so rank/review P0s can bury the money work.

**Change:**

- When `auditPrefersConversionOverRank(audit)` (or pack share ≥ 0.5 + conversion gap present), elevate those gaps to **P0** (or P1 minimum).
- Keep rank-outside-pack as P0 when pack share &lt; 0.5.
- Ensure `resolveForcedPlanStepNumbers` still forces `CONVERSION_PLAN_STEPS`.

**Accept:** Fixture “visible, 0 actions” → NBA top 3 ⊆ `{8, 11, 13, 15}` and conversion gaps appear as P0/P1 in strategy gap list.

### 1.3 Align Path-to-Healthy header with Plan order

**Problem:** Header can show a calibrated greedy path while the phase list uses uncalibrated isolation scores.

**Change:** Progress / revenue projection in `PlanProgressHeader` should use the **same ordered unfinished steps** as Plan `displayOrder` (or explicitly label Path as “suggested path” only if divergent). Prefer one source of truth: calibrated ordered plan steps.

**Accept:** Header `$/mo` or leads delta equals sum (damped) of top unfinished plan steps’ calibrated impacts, not a separate gap teleport path.

---

## Phase 2 — Ground claims + fix mutation integrity (~8.2)

Stops the model from promising pack entry it cannot execute.

### 2.1 Evidence-gate rank deltas

**Problem:** `DEFAULT_RANK_IMPROVEMENT = 2` and `rankDeltaForStep` credit description/services/posts with pack movement by default.

**Change in `counterfactual.ts`:**

| Confidence | Rank claim behavior |
|------------|---------------------|
| `default` / `low` | Cap heuristic rank delta at **1** for steps 3/4/5/8; show UI as “model est.” |
| `medium` | Use blended median rank delta (existing calibration path) |
| `high` | Allow up to current cap (5) from calibration |

Optionally multiply uncalibrated rank revenue by a **confidence factor** (e.g. 0.4) so `$/mo` is not overstated before evidence.

**Accept:** Uncalibrated outside-pack fixture no longer shows step 3 with large `$/mo` from a +2 rank teleport; label remains “model est.”

### 2.2 Make step mutations match executable work

| Step | Today | Target |
|------|--------|--------|
| **5** Priority keyword services | `applyStepMutation` no-op; still gets rank outcome | Mutate services from recommended priority blocks (same as task publish payload); satisfaction tied to missing priority services |
| **1** Primary category | Mutation invents secondaries from tokens | Mutate **primary category only**; secondaries belong to step 2 |
| **Rank-outside-pack gaps** | Outcome teleport without executable action | Gaps only contribute to path when linked to an unfinished plan step via `gapLinksToStep`; never standalone “close gap” revenue |

**Files:** `counterfactual.ts`, `gbp-plan.ts`, `gaps.ts` / gap→step linking, `gbp-plan-tasks.ts`.

**Accept:** Completing step 5 in simulation changes `liveProfile.services`; rank-outside-pack gap alone cannot enter Path pool without a linked step.

### 2.3 Stop double-counting conversion + rank on posts

Step 8 is in both rank levers and `CONVERSION_PLAN_STEPS`. Keep dual role, but:

- In conversion-prefer mode, score step 8 on **engagement** channel only (already mostly true — verify no pack claim when `auditPrefersConversionOverRank`).
- In outside-pack mode, allow modest rank claim (gated by 2.1).

**Accept:** Unit test: conversion-prefer + step 8 → `engagementActionsGain > 0` and rank keywords unchanged.

---

## Phase 3 — Effort-aware ROI + smarter conversion (~8.6)

### 3.1 Effort / time in ordering

Gaps already use `impact × (11 - effort)`. Port a simple effort table into plan scoring:

```ts
// illustrative
effortByStep: { 15: 2, 13: 2, 8: 3, 11: 3, 3: 4, 4: 4, 5: 4, 10: 7, 6: 6, ... }
score = impactScore / max(effort, 1)
```

Or `impact - effortPenalty`. Keep Google Updates (0) pinned.

**Accept:** When impacts are similar, place actions / attributes beat “request 50 reviews”; review requests still win when review gap is the clear pack blocker.

### 3.2 Channel-specific conversion levers

**Problem:** Engagement is aggregated; business that needs **calls** vs **directions** gets the same pool `{15, 8, 13, 11}`.

**Change:**

- From performance metrics, detect dominant gap: low calls vs low directions vs low website clicks (relative to category baselines or pack peers if available).
- Reorder `CONVERSION_LEVERS` / NBA boost:
  - Low calls → prefer 15 (call/booking), 8 (CTA), 11 (trust)
  - Low directions → prefer 15 (directions/appointment), 13 (attributes like wheelchair/parking), hours (12) if broken
  - Low website clicks → prefer 15 website link, 13, 8

**Files:** `keyword-action-binding.ts`, `conversion-constants.ts`, `plan-next-actions.ts`, `gaps.ts`.

**Accept:** Fixture with high directions + near-zero calls elevates call-oriented place action / CTA over website-click attributes.

### 3.3 Lower the conversion detection floor carefully

Today conversion gaps require `profileViews >= 100`. Consider:

- Soft signal at 40–99 views with action rate 0% → P2 + mild NBA boost (not full forced reorder)
- Full boost remains at ≥100

**Accept:** Low-traffic listings get a nudge without drowning rank work.

### 3.4 Custom steps (18+) get bounded impact

Allow LLM custom steps to carry **qualitative priority** plus optional linked standard step numbers for scoring. If a custom step maps to an executable GBP action type already in the system, estimate engagement/revenue via that action type; otherwise keep null `$` but allow NBA inclusion via strategist priority flag.

**Accept:** Custom steps never fabricate `$`; they can appear in top 3 only with explicit `selectionPriority` or linked action type.

---

## Phase 4 — Plan UX for outcomes (~9.0)

Product changes so users *do* the high-ROI work.

### 4.1 First viewport = revenue next actions

In `PlanView` / `PlanProgressHeader`:

1. Lead with **Est. calls+directions/mo** (or `$/mo` if ACV) current → projected  
2. Reputation Boost Score secondary (smaller text)  
3. Keep NBA + keyword playbooks above phases  
4. Collapse completed phases by default

### 4.2 Keyword playbooks: money keywords, not only top 3 list length

- Prefer keywords by **revenue gap** (or impression-weighted outside-pack), not only `keywordPriority` order
- Raise limit to 5 when &gt;3 keywords have material gap
- Long-tail outside-pack with impressions &gt; median still gets a playbook row

### 4.3 Step cards: outcome-first copy

In `PlanStepCard` / `step-context.ts`:

- Primary line: expected **actions/mo** or **$/mo**  
- Secondary: ranking pts / health pts  
- Expected effect copy must mention calls, directions, or pack position explicitly (no vague “improve visibility” for conversion steps)

### 4.4 Faster feedback for manual steps

For steps without API tasks: one-click “Mark done & refresh plan” that triggers reconcile, so the closed loop in Phase 1 actually updates order after offline GBP edits.

---

## Suggested implementation order (PRs)

| PR | Scope | Risk |
|----|--------|------|
| **PR1** | Phase 0 fixtures + Phase 1.1 calibration in `displayOrder` | Medium — ordering changes; needs golden tests |
| **PR2** | Phase 1.2 conversion gap priority + 1.3 header alignment | Low–medium |
| **PR3** | Phase 2 rank gating + mutation fixes | Medium — counterfactual semantics |
| **PR4** | Phase 3 effort + channel-specific conversion | Medium |
| **PR5** | Phase 4 UX | Low |

Do **not** start with LLM prompt tweaks; determinism and closed-loop ordering move the score more than better copy.

---

## Out of scope (keeps “9” honest)

- Predicting exact Maps rank for a keyword (Google doesn’t expose this elasticity)
- Guaranteeing revenue without ACV / lead tracking beyond GBP actions
- Replacing human approval for publish
- Auto-posting without user consent

---

## Definition of done checklist

- [ ] Golden fixtures green in CI for the six scenarios in Phase 0
- [ ] `orderGbpPlanStepsByImpact` accepts and uses attribution calibration
- [ ] Visible + under-converting businesses get conversion-first NBA **and** phase order
- [ ] Uncalibrated rank `$` claims are capped / labeled; calibrated claims use medians
- [ ] Step 5 mutation + satisfaction match priority services publish path
- [ ] Rank-outside-pack gaps cannot invent path revenue without a linked plan step
- [ ] Effort-aware sort prevents photo/review busywork from beating fast CTA wins when impacts are close
- [ ] Plan header leads with actions or `$`, not only Reputation Boost Score
- [ ] Manual QA: one real connected GBP — publish top NBA, see Results attribution, refresh Plan, confirm order shifts toward what worked

---

## Working score rubric (re-rate after each PR)

| Dimension | Weight | 6.5 baseline | 9 target |
|-----------|--------|--------------|----------|
| Prioritize highest-ROI next action | 25% | 7 | 9 |
| Rank causality honesty | 20% | 5 | 8.5 |
| Views → calls/directions conversion | 25% | 7.5 | 9.5 |
| Revenue linkage (ACV/leads) | 15% | 6 | 9 |
| Closed loop after publish | 15% | 5 | 9 |

Weighted target ≈ **9.0** when all phases land.
