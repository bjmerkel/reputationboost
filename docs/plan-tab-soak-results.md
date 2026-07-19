# Plan Tab — Live Soak Results

**Date:** YYYY-MM-DD  
**Tester:**  
**Build / branch:**  
**Environment:** production | staging | local

## Businesses tested

| # | Business name | Profile type | GBP connected | Notes |
|---|---------------|--------------|---------------|-------|
| 1 | | In-pack, under-converting | yes/no | High views, low calls/directions |
| 2 | | Outside-pack, high impressions | yes/no | Review gap vs pack leader |
| 3 | | New account (<3 publishes) | yes/no | No calibration yet |

---

## Checklist results

Copy items from `PLAN_SOAK_CHECKLIST` in `src/audit/phase3/plan-proof-pack.ts`.

| # | Checklist item | Biz 1 | Biz 2 | Biz 3 | Notes |
|---|----------------|-------|-------|-------|-------|
| 1 | No ACV → steps + header show leads/mo; NBA order sensible | | | | |
| 2 | Set ACV → $/mo appears; step order still sensible | | | | |
| 3 | Curated plan → Refresh Plan → step count does not explode | | | | |
| 4 | Publish conversion step → See results deep-link works | | | | |
| 5 | Stack two high-impact steps → stacked estimate dampened | | | | |
| 6 | Win these searches CTA opens bound step for keyword | | | | |
| 7 | In-pack + low action rate → NBA leads with 8/11/13/15 | | | | |
| 8 | After attributed publishes → impact labels lose “model” wording | | | | |
| 9 | 40+ photos + weak CTR → Photos not top NBA | | | | |
| 10 | Batch approve opens highest-impact pending task first | | | | |
| 11 | Custom strategist step shows qualitative signal | | | | |
| 12 | First viewport: progress → NBA → keyword playbooks | | | | |
| 13 | Reject review reply → sibling replies stay visible | | | | |
| 14 | Refresh profile data triggers full sync + reconcile | | | | |
| 15 | Manual steps auto-sync on Plan tab open | | | | |
| 16 | Google conflict panel context-only; actions in step 0 | | | | |
| 17 | Without ACV, playbooks show leads/mo not dollars | | | | |
| 18 | Completed step shows Measuring / Early signal | | | | |
| 19 | Stay on track shows maintenance cadence | | | | |
| 20 | Outside-pack + review gap → step 10 in NBA top 3 | | | | |

**Pass threshold:** ≥95% of applicable items per business (≥19/20 when all apply).

---

## NBA snapshot (top 3 per business)

### Business 1 — In-pack under-converting

| Rank | Step # | Title | Impact label |
|------|--------|-------|--------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Expected:** Steps 8, 11, 13, and/or 15  
**Actual match:** pass / fail  
**Notes:**

### Business 2 — Outside-pack review velocity

| Rank | Step # | Title | Impact label |
|------|--------|-------|--------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Expected:** Step 10 among top 3  
**Actual match:** pass / fail  
**Notes:**

### Business 3 — New account

| Rank | Step # | Title | Impact label |
|------|--------|-------|--------------|
| 1 | | | |
| 2 | | | |
| 3 | | | |

**Notes:**

---

## Bugs filed

| ID | Severity | Summary | Repro steps |
|----|----------|---------|-------------|
| | P0/P1/P2 | | |

---

## Sign-off

- [ ] CI green (`npm test`)
- [ ] Soak pass rate ≥95%
- [ ] No P0 ordering bugs open
- [ ] Ready to promote / not ready (explain)

**Overall result:** pass | fail | pass with exceptions
