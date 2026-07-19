# Plan Tab — Comprehensive Roadmap (8.5 → 9.5)

**Purpose:** Actionable engineering and product plan to make the Plan tab reliably drive higher local-pack rankings, more profile views, more calls/directions/website clicks, and more revenue.

**Audience:** Engineering, product, QA  
**Companion doc:** [`plan-tab-path-to-9.md`](./plan-tab-path-to-9.md) (Phases 0–4 — largely implemented)  
**Current effectiveness:** **8.5 / 10** (code review, Jul 2026)  
**Target effectiveness:** **9.5 / 10** (validated on live GBPs)

---

## 1. Executive summary

The Plan tab is already a revenue-oriented GBP optimization system — not a checklist. It impact-ranks 18+ GBP levers, switches to conversion-first mode when a profile is visible but under-acting, binds money keywords to executable steps, publishes many changes via API, and closes the loop through Results attribution.

**What’s left is not “build a plan tab.”** It is:

1. **Validate** that Phases 0–4 behave correctly on real businesses (soak + fix regressions).
2. **Sharpen priors** with peer-relative benchmarks and vertical models.
3. **Accelerate learning** so new accounts benefit from attribution sooner.
4. **Resolve rank blockers** (especially review velocity outside the 3-pack) without burying conversion work for visible profiles.
5. **Polish UX** so the first viewport screams “more calls/directions/$” and friction drops on manual steps.

---

## 2. North-star outcomes

A business that follows Plan next-best actions for **30–60 days** should see measurable movement on:

| Outcome | Primary signal | Secondary signal |
|---------|----------------|------------------|
| **Rankings** | More keywords in local 3-pack | Impressions ↑ on target terms |
| **Visibility** | Profile views ↑ | Search keyword coverage ↑ |
| **Conversion** | Calls + directions + website clicks ↑ | Action rate ↑ (actions ÷ views) |
| **Revenue** | $/mo ↑ (when ACV set) | Leads/mo ↑ (without ACV) |

### Success metrics (product)

Track per cohort (connected GBP, Plan opened ≥1×):

| Metric | Baseline (today) | Target (90 days post-launch) |
|--------|------------------|------------------------------|
| Plan → publish conversion (≥1 task in 14d) | Measure | +25% vs baseline |
| Median actions/mo delta (attributed publishes) | Measure | +15% for conversion-first cohort |
| NBA click-through (scroll to step) | Measure | ≥40% of Plan sessions |
| ACV completion rate | Measure | ≥50% of active businesses |
| Attribution calibration coverage (≥1 step with n≥2) | Measure | ≥60% of businesses with 3+ publishes |
| User-reported “plan order made sense” (soak) | N/A | ≥8/10 |

### Effectiveness score rubric (re-rate after each phase)

| Dimension | Weight | Now (8.5) | Target (9.5) |
|-----------|--------|-----------|--------------|
| Prioritize highest-ROI next action | 25% | 9.0 | 9.5 |
| Rank causality honesty | 20% | 7.5 | 9.0 |
| Views → calls/directions conversion | 25% | 9.0 | 9.5 |
| Revenue linkage (ACV/leads) | 15% | 8.0 | 9.5 |
| Closed loop after publish | 15% | 8.0 | 9.5 |

---

## 3. Current state (what exists)

### 3.1 Architecture (no change needed)

```
Audit + GBP performance
  → detectGaps()                    # src/audit/phase2/gaps.ts
  → buildAllGbpPlanSteps()            # src/audit/phase2/gbp-plan.ts
  → orderGbpPlanStepsByImpact()       # revenue, leads, engagement, effort, calibration
  → buildPlan()                       # src/audit/phase3/build-plan.ts
  → PlanView UI                       # src/components/plan/*
  → Approve & publish                 # src/app/api/execution/*, src/app/api/google/gbp/*
  → Results attribution               # src/audit/attribution/*
  → buildAttributionCalibration()     # reorders Plan on reconcile
```

### 3.2 Implemented capabilities (Phases 0–4)

| Capability | Key files | Status |
|------------|-----------|--------|
| Impact-ranked `displayOrder` | `gbp-plan.ts`, `plan-prioritization.ts` | ✅ |
| Conversion-first NBA + gap P0 | `conversion-boost.ts`, `gaps.ts`, `plan-next-actions.ts` | ✅ |
| Channel-specific levers (calls/directions/web) | `conversion-channel.ts` | ✅ |
| Effort-aware ROI | `PLAN_STEP_EFFORT` in `gbp-plan.ts` | ✅ |
| Attribution calibration in ordering | `attribution-calibration.ts`, `build-plan.ts` | ✅ |
| Conservative uncalibrated rank priors | `rank-priors.ts`, `attribution-calibration.ts` | ✅ |
| Keyword playbooks (top 5) | `keyword-action-binding.ts`, `PlanKeywordPlaybooks.tsx` | ✅ |
| Revenue-first header | `PlanProgressHeader.tsx`, `path-to-healthy.ts` | ✅ |
| Completed phases collapsed | `PlanPhaseSection.tsx`, `plan-display.ts` | ✅ |
| Manual step auto-reconcile | `plan-manual-sync.ts`, `reconcile-plan.ts` | ✅ |
| Golden fixtures | `plan-path-to-nine.test.ts`, `plan-proof-pack.test.ts` | ✅ (781/782 tests pass) |

### 3.3 Known gaps (from code review)

| Gap | Impact on revenue goal | Severity |
|-----|------------------------|----------|
| Rank lift is modeled, not causal | Over-optimistic $ for new outside-pack accounts | High |
| Calibration requires n≥2 per step | Cold-start uses flat heuristics | High |
| Conversion rates are fixed % of views | Vertical mismatch (e.g. lawyer vs restaurant) | Medium |
| Channel targets are category-regex, not peer-based | Mis-prioritizes when peers convert differently | Medium |
| Review velocity not explicit pack-entry blocker | Outside-pack may under-prioritize reviews | Medium |
| Google Updates panel above revenue header | Revenue message not first pixel | Low |
| 1 failing attribute-plan test | Regression risk in attributes step | Low |
| No multi-location orchestration | Franchise use case weak | Out of scope |

---

## 4. Roadmap overview

| Phase | Name | Effectiveness lift | Risk | Depends on |
|-------|------|-------------------|------|------------|
| **5** | Validate & harden (close path-to-9) | 8.5 → 8.8 | Low | — |
| **6** | Peer-relative benchmarks | 8.8 → 9.1 | Medium | Rankings collector data |
| **7** | Fast calibration (n=1 + priors) | 9.1 → 9.3 | Medium | Attribution pipeline |
| **8** | Outside-pack review intelligence | 9.3 → 9.4 | Medium | `packLeaderReviewCount`, gaps |
| **9** | UX friction & revenue viewport | 9.4 → 9.5 | Low | Phases 5–8 |
| **10** | Vertical conversion models (stretch) | 9.5 → 9.7 | High | Historical data / backtest |

**Recommended PR order:** 5 → 8 → 6 → 7 → 9 → 10

Rationale: fix regressions and review-blocker logic before changing benchmark math; UX polish last so copy matches final scoring behavior.

---

## 5. Phase 5 — Validate & harden (8.5 → 8.8)

**Goal:** Prove Phases 0–4 on real GBPs; fix regressions; check off `plan-tab-path-to-9.md` definition-of-done.

### 5.1 Fix attribute-plan regression

| Item | Detail |
|------|--------|
| **Problem** | `attribute plan integration` test fails: “explains the reputation score impact in step context” |
| **Files** | `src/audit/phase3/step-context.ts`, attribute-related tests, `PlanStepAttributes.tsx` |
| **Accept** | Full test suite green (782/782) |

### 5.2 Live soak checklist (mandatory gate)

Run `PLAN_SOAK_CHECKLIST` from `src/audit/phase3/plan-proof-pack.ts` on **≥3 live business profiles**:

- One **in-pack, under-converting** (high views, low actions)
- One **outside-pack, high impressions**
- One **new account** (&lt;3 publishes, no calibration)

Document outcomes in `docs/plan-tab-soak-results.md` (pass/fail per item, screenshots optional).

### 5.3 Close path-to-9 definition-of-done

Mark items in `plan-tab-path-to-9.md` checklist based on soak + CI:

- [ ] Golden fixtures green
- [ ] Calibration in `displayOrder`
- [ ] Conversion-first NBA + phase order
- [ ] Uncalibrated rank claims capped/labeled
- [ ] Step 5 mutation integrity
- [ ] Rank gaps cannot invent path revenue
- [ ] Effort-aware sort
- [ ] Header leads with actions/$
- [ ] Manual QA on live GBP

### 5.4 Instrumentation for product metrics

| Event | Where | Purpose |
|-------|-------|---------|
| `plan_nba_click` | `PlanNextBestActions.tsx` | NBA engagement |
| `plan_keyword_playbook_cta` | `PlanKeywordPlaybooks.tsx` | Keyword CTA usage |
| `plan_publish_success` | execution API routes | Publish funnel |
| `plan_reconcile_live` | `plan-manual-sync.ts` | Manual step completion |

**Accept:** Events emitted (or server-side logs) for soak businesses; dashboard query documented.

### Phase 5 exit criteria

- CI 100% green
- Soak checklist ≥90% pass on 3 live profiles
- No P0 ordering bugs filed from soak

---

## 6. Phase 6 — Peer-relative benchmarks (8.8 → 9.1)

**Goal:** Replace fixed conversion targets with peer-aware thresholds so call/direction prioritization matches the market.

### 6.1 Peer action-rate baselines

**Today:** `resolveCategoryChannelTargets()` in `conversion-channel.ts` uses regex on primary category.

**Target:** Blend category defaults with pack-peer signals already in audit data:

```ts
// New: src/audit/phase2/peer-benchmarks.ts
interface PeerActionBenchmarks {
  callsPerView: number;      // p50 of pack leaders or category fallback
  directionsPerView: number;
  websitePerView: number;
  reviewCountP50: number;      // from packLeaderReviewCount across keywords
  confidence: "peer" | "category" | "default";
}
```

**Data sources:**

- `audit.rankings.keywords[].packLeaderReviewCount` — `src/audit/collectors/rankings.ts`
- `audit.gbp.performance` — calls, directions, websiteClicks, profileViews
- Category table in `conversion-channel.ts` (fallback)

**Integration points:**

| Consumer | Change |
|----------|--------|
| `resolveConversionChannelBias()` | Compare deficits vs peer benchmarks, not only category defaults |
| `detectGaps()` weak conversion | Use peer action-rate p25 as “weak” threshold instead of flat 3% |
| `PlanKeywordPlaybooks` | Show “vs pack median” on action rate when peer data exists |
| `step-context.ts` | Copy: “Pack leaders convert ~X% of views to calls; you’re at Y%” |

**Accept:**

- Fixture with peer calls/view = 4%, business at 0.5% → `calls` channel bias
- Fixture with no peer data → identical behavior to today (category fallback)
- Unit tests in `peer-benchmarks.test.ts`

### 6.2 Impression-weighted keyword opportunity

**Today:** Keyword playbooks sort by priority score + revenue gap.

**Enhancement:** Weight outside-pack keywords by `impressions × (packLeaderReviewCount gap)` so a high-volume term with a reachable review gap surfaces above a low-volume term.

**Files:** `keyword-action-binding.ts`, `keyword-scores.ts`

**Accept:** Fixture: keyword A (500 imp, 20 reviews behind leader) ranks above keyword B (50 imp, 5 reviews behind).

---

## 7. Phase 7 — Fast calibration (9.1 → 9.3)

**Goal:** New accounts benefit from publish feedback before n≥2; widen confidence bands instead of ignoring n=1.

### 7.1 n=1 partial calibration

**Today:** `stepConfidenceMultiplier()` returns 0.6 when `sampleSize < 2`; engagement blend requires n≥2.

**Target:**

| sampleSize | Confidence multiplier | Rank delta behavior | UI label |
|------------|----------------------|---------------------|----------|
| 0 | 0.6 | Uncalibrated prior | “Model estimate” |
| 1 | 0.75 | Blend 50% prior + 50% observed | “Early signal” |
| 2–4 | 0.85 | Median blend | “Calibrated estimate” |
| 5+ | 1.0 | Full median | “Calibrated” |

**Files:**

- `src/audit/phase2/attribution-calibration.ts` — `blendEngagementRates`, `stepConfidenceMultiplier`
- `src/audit/phase2/plan-prioritization.ts`
- `src/components/audit/path-impact-display.ts` — labels
- `PlanStepCard.tsx` — “Early signal” badge when n=1

**Accept:**

- Single positive attribution for step 15 increases step 15 score vs step 8
- Negative n=1 attribution demotes step via existing `negativeEvidencePenalty`
- Golden fixture: n=1 does not exceed n≥2 calibrated ceiling

### 7.2 Global calibration pool (optional, same PR or follow-up)

When per-step n&lt;2, borrow engagement rates from **same category + step type** across tenants (anonymized aggregates).

**Files:** New `src/audit/phase2/global-calibration-pool.ts`, nightly job in `ingest-daily.ts`

**Privacy:** Only aggregated medians; no cross-tenant raw data in API responses.

**Accept:** New account with zero publishes uses global pool for step 15 > generic heuristic.

---

## 8. Phase 8 — Outside-pack review intelligence (9.3 → 9.4)

**Goal:** When reviews are the binding constraint for pack entry, say so explicitly — without breaking conversion-first for visible profiles.

### 8.1 Review gap as pack-entry blocker

**New gap detector** in `gaps.ts`:

```ts
// Trigger when ALL of:
// - keyword outside pack
// - business review count < packLeaderReviewCount * 0.6 (configurable)
// - impressions above median for portfolio
// → gap id: "review-velocity-{keyword}"
// → priority: P0 when pack share < 0.5, else P2
```

**Bind to step 10** in `keyword-action-binding.ts` (`OUTSIDE_PACK_LEVERS` already includes 10; ensure primary step selection prefers 10 when review gap is binding).

### 8.2 NBA override rule (narrow)

| Condition | NBA behavior |
|-----------|--------------|
| `packShare < 0.5` AND review-velocity gap on top keyword | Allow step 10 in top 3 even in soft conversion mode |
| `packShare >= 0.5` AND conversion boost | Keep top 3 ⊆ {8,11,13,15} (unchanged) |
| `packShare < 0.5` AND no review gap | Rank levers {5,4,3,8,10} (unchanged) |

**Files:** `gaps.ts`, `plan-next-actions.ts`, `keyword-action-binding.ts`, `plan-candidates.ts`

**Accept:**

- Outside-pack, 50 reviews vs leader 200, high impressions → step 10 in NBA top 3
- In-pack under-converting → step 10 NOT in NBA top 3
- Golden fixture in `plan-path-to-nine.test.ts`

### 8.3 Step card copy for review campaigns

`step-context.ts` / `PlanStepCard.tsx`:

- Primary: “~N reviews to reach pack median for «keyword»”
- Secondary: leads/mo from improved pack share (use existing `estimateStepOutcomeImpact`)

---

## 9. Phase 9 — UX friction & revenue viewport (9.4 → 9.5)

**Goal:** First viewport = revenue outcome; reduce friction on manual and partial-API steps.

### 9.1 Revenue-first viewport reorder

**Today:** `GoogleUpdatesPanel` → `PlanProgressHeader` → NBA → playbooks.

**Target:**

```
IF google_updates_pending:
  compact banner (1 line) + link to step 0
ELSE:
  skip panel entirely
PlanProgressHeader (always first substantive block)
PlanNextBestActions
PlanKeywordPlaybooks
...
GoogleUpdatesPanel full (only when conflicts exist OR user expands)
```

**Files:** `PlanView.tsx`, `GoogleUpdatesPanel.tsx`, `plan-display.ts`

**Accept:** Soak item “First Plan viewport reads: progress → NBA → keyword playbooks” passes without scrolling on 375px width.

### 9.2 Stronger ACV nudge with revenue preview

`PlanAcvNudge.tsx`: show example “At $350/job, your top 3 actions ≈ $X/mo” using `path.nextThreeProjectedMonthlyRevenue` logic without ACV (use industry default from category).

**Accept:** Clicking nudge → Settings ACV field; return triggers reconcile (existing).

### 9.3 One-click “Mark done & refresh” for manual steps

For steps without API tasks (or partial API), add button on `PlanStepCard`:

```tsx
<button onClick={() => reconcilePlanNow({ live: true })}>
  Mark done & refresh plan
</button>
```

Reuse `reconcilePlanNow` from `usePlanTasks`; show `reconcileFeedbackMessage` (pattern exists in `PlanView`).

**Accept:** Manual hours edit in Google → one click → step completes + order updates.

### 9.4 Outcome-first copy audit

Sweep `step-context.ts`, `plan-ux-copy.ts`, `plan-impact-label.ts`:

- Conversion steps: must mention calls, directions, or clicks — never “improve visibility” alone
- Rank steps: must mention pack position or keyword
- All material steps: primary label is $/mo, leads/mo, or actions/mo

**Accept:** `plan-proof-pack.test.ts` extended; no step with `engagementImpact > 0` shows only ranking pts.

---

## 10. Phase 10 — Vertical conversion models (stretch, 9.5 → 9.7)

**Goal:** Replace flat view→action heuristics with learned priors per vertical.

### 10.1 Backtest harness

Use existing `scripts/score-backtest.ts` / `projection-accuracy.test.ts` pipeline:

1. Collect attributed publishes (step type, category, pre/post actions)
2. Fit view→action rates per (stepNumber, categoryBucket)
3. Store in `src/audit/phase2/conversion-priors.json` or DB table
4. `heuristicConversionEngagementRates()` reads priors with category fallback

### 10.2 Quarterly prior refresh

Cron or manual script updates priors; version stamped in plan metadata for debugging.

**Accept:** Backtest shows ≥10% lower MAE on engagement projections vs flat heuristics on holdout set.

**Out of scope if insufficient data:** Ship Phase 10 only when n≥500 attributed conversion-step publishes across ≥10 categories.

---

## 11. PR breakdown

| PR | Phase | Scope | Files (primary) | Risk |
|----|-------|-------|-----------------|------|
| **PR-A** | 5 | Fix attribute test + soak doc template | tests, `step-context.ts` | Low |
| **PR-B** | 5 | Plan analytics events | `PlanView`, API routes | Low |
| **PR-C** | 8 | Review-velocity gap + NBA override | `gaps.ts`, `plan-next-actions.ts` | Medium |
| **PR-D** | 6 | Peer benchmarks module | new `peer-benchmarks.ts`, `conversion-channel.ts` | Medium |
| **PR-E** | 7 | n=1 calibration + UI labels | `attribution-calibration.ts`, `path-impact-display.ts` | Medium |
| **PR-F** | 7 | Global calibration pool (optional) | `global-calibration-pool.ts`, `ingest-daily.ts` | Medium |
| **PR-G** | 9 | Viewport reorder + ACV preview | `PlanView.tsx`, `PlanAcvNudge.tsx` | Low |
| **PR-H** | 9 | Manual step refresh button + copy audit | `PlanStepCard.tsx`, `step-context.ts` | Low |
| **PR-I** | 10 | Vertical priors backtest + ship | `counterfactual.ts`, scripts | High |

**Do not parallelize PR-C and PR-D** without merging test fixture updates — both touch NBA ordering.

---

## 12. Testing strategy

### 12.1 Automated (CI)

| Suite | Covers |
|-------|--------|
| `plan-path-to-nine.test.ts` | Conversion-first, calibration reorder, rank caps, mutations |
| `plan-proof-pack.test.ts` | J1–J6, R1–R6 acceptance criteria |
| `plan-next-actions.test.ts` | NBA ordering edge cases |
| `keyword-action-binding.test.ts` | Playbook bindings |
| `peer-benchmarks.test.ts` (new) | Phase 6 |
| `review-velocity-gap.test.ts` (new) | Phase 8 |

**CI gate:** No PR merges if any plan test fails or if new ordering fixtures are not updated.

### 12.2 Golden fixtures to add

| Scenario | Expected top-3 steps |
|----------|---------------------|
| Outside-pack, review gap 3× behind leader | 10, 5 or 4, 3 |
| Peer calls deficit, in-pack | 15, 8, 11 |
| n=1 positive attribution step 13 | 13 rises in `displayOrder` |
| Google updates pending + conversion mode | Step 0 forced; NBA still conversion after 0 |

### 12.3 Manual soak (per release)

Minimum 1 business per release from `PLAN_SOAK_CHECKLIST`. Block release if:

- NBA top 3 clearly wrong for business type (product sign-off)
- Publish → Results → Plan reorder broken

---

## 13. Rollout & monitoring

### 13.1 Feature flags

| Flag | Controls | Default |
|------|----------|---------|
| `plan.peer_benchmarks` | Phase 6 peer targets | off → gradual |
| `plan.n1_calibration` | Phase 7 partial calibration | off → on |
| `plan.review_velocity_gap` | Phase 8 gap + NBA | on (low risk) |
| `plan.compact_google_updates` | Phase 9 viewport | on |

### 13.2 Rollout sequence

1. Internal dogfood (3 accounts)
2. 10% of connected GBPs (flag)
3. 100% after 7 days with no ordering regressions

### 13.3 Alerts

- Spike in `plan_publish_success` failures
- Drop in NBA click-through &gt;20% week-over-week
- Attribution `preliminary` rate &gt;80% (window not closing)

---

## 14. Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Ordering changes confuse existing users | Flags + changelog in Plan header for 2 weeks |
| Peer data sparse for niche categories | Fallback to category defaults; show “low confidence” |
| n=1 overfits noise | Cap n=1 boost at 75% of n≥2; negative evidence still demotes |
| Review campaigns prioritized too aggressively | Only P0 when outside-pack + impression-weighted review gap |
| Over-promising rank $ | Keep 0.4 uncalibrated discount; never remove “model estimate” label |

---

## 15. Out of scope (keeps 9.5 honest)

- Guaranteed Maps rankings or revenue
- Multi-location / franchise plan orchestration
- Auto-publish without approval
- Replacing GBP with a third-party listing tool
- ML black-box rank prediction
- Competitor ad spend / paid search optimization

---

## 16. Definition of done — 9.5

- [ ] Effectiveness re-score ≥ **9.5** on weighted rubric (Section 2)
- [ ] CI 100% green including new peer + review-velocity tests
- [ ] Soak checklist ≥95% on 5 live businesses (mix of in-pack / outside-pack / new)
- [ ] Product metrics instrumentation live
- [ ] Peer benchmarks active for ≥70% of audits with pack leader data
- [ ] n=1 calibration live; ≥30% of businesses show “Early signal” within 14d of first publish
- [ ] Outside-pack review gap surfaces step 10 when review velocity is binding
- [ ] First viewport shows revenue/actions projection without scrolling (mobile)
- [ ] No material step shows ranking-only impact when engagement impact exists
- [ ] Post-launch: attributed actions/mo +15% for conversion-first cohort at 90 days (if baseline measured in Phase 5)

---

## 17. Quick reference — key files

| Concern | Path |
|---------|------|
| Plan tab UI | `src/components/plan/*` |
| Impact scoring | `src/audit/phase2/gbp-plan.ts`, `plan-prioritization.ts` |
| Gaps | `src/audit/phase2/gaps.ts` |
| Conversion logic | `src/audit/phase2/conversion-boost.ts`, `conversion-channel.ts` |
| Keywords | `src/audit/phase2/keyword-action-binding.ts` |
| Calibration | `src/audit/phase2/attribution-calibration.ts` |
| Rank honesty | `src/audit/phase2/rank-priors.ts`, `counterfactual.ts` |
| Plan build | `src/audit/phase3/build-plan.ts`, `reconcile-plan.ts` |
| Acceptance tests | `src/audit/phase2/plan-path-to-nine.test.ts`, `src/audit/phase3/plan-proof-pack.ts` |
| Product spec (0–4) | `docs/plan-tab-path-to-9.md` |

---

## 18. Immediate next actions (start here)

1. **PR-A:** Fix failing attribute-plan test; add `docs/plan-tab-soak-results.md` template.
2. **Run soak** on 3 live GBPs using `PLAN_SOAK_CHECKLIST`; file bugs for any fail.
3. **PR-C:** Ship review-velocity gap — highest revenue impact for outside-pack segment.
4. **PR-D + PR-E:** Peer benchmarks + n=1 calibration in parallel after PR-C merges.
5. **PR-G:** Viewport polish once ordering behavior is stable.
