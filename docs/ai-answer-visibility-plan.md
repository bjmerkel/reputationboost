# AI Answer Visibility — Comprehensive Plan

**Purpose:** Product and engineering plan for tracking whether AI assistants (ChatGPT, Gemini, Google AI Overviews / AI Mode) recommend the customer's business for high-intent local queries ("best X near me"), shipped as a core capability of the platform alongside Maps rank tracking — included for every business, no add-on gating.

**Audience:** Engineering, product, QA
**Companion docs:** [`plan-tab-comprehensive-roadmap.md`](./plan-tab-comprehensive-roadmap.md), [`plan-tab-path-to-9.md`](./plan-tab-path-to-9.md)
**Status:** Proposed (no code exists yet — this is a greenfield surface beside the Maps stack)

---

## 1. Executive summary

Reputation Boost today measures one discovery channel: Google Maps / Local Pack, via sampled Places Text Search grids (`rank_snapshots`, `grid_snapshots`), rolled into the Reputation Boost Score and monetized through the score → rank → calls → revenue loop.

A second discovery channel is emerging: **AI answers**. When a consumer asks ChatGPT, Gemini, or Google (AI Overviews / AI Mode) "who's the best plumber near me," a small set of businesses gets named — and everyone else is invisible. No analytics surface tells a local business whether they're in that set. This plan adds an **AI Answer Visibility** pillar that:

1. **Probes** the three surfaces on a fixed cadence with a prompt panel derived from the business's tracked keywords (`businesses.keywords`).
2. **Parses** each answer for business mentions, recommendation position, citations, competitors, and sentiment.
3. **Stores** results in snapshot tables mirroring the rank-tracking data model, with the same cost-governance patterns (monthly budgets, idempotent claims, caching).
4. **Surfaces** trends in the platform UI (Results + Audit Data + Home tile) as a distinct "AI Visibility" metric — parallel to, not blended into, the existing score.
5. **Feeds** remediation into the existing Plan pipeline as new gaps/steps, because the levers that move AI answers (reviews, categories, services, description keywords, website/schema, third-party mentions) largely overlap with GBP work we already automate.

Strategic framing: this ships as **core product for every business** — a fourth pillar of the platform's visibility story, not a gated upsell. It is still **not a fourth score input** (initially): the score → rank → calls → revenue path stays primary, the overall score formula is untouched, and AI visibility is a parallel metric until attribution data justifies blending. It reuses ~80% of existing infrastructure patterns (keyword source of truth, cron + budget governance, snapshot → rollup → UI, Plan gaps/steps). Marginal cost is ~$1–1.50/business/month (§7), small enough to absorb into every tier as a differentiation and retention lever.

---

## 2. Product definition

### 2.1 What the customer sees

- **"Does AI recommend you?"** — per keyword, per surface: mentioned / not mentioned, with the actual answer excerpt and who *was* recommended.
- **AI Visibility Score (0–100)** — blended mention rate weighted by keyword revenue value (reusing keyword weighting from `keyword-portfolio.ts`).
- **AI Share of Voice** — the business's mentions ÷ all business mentions across probed answers, with a competitor leaderboard (same competitors already tracked in `competitor_profile_snapshots` where identity-matchable).
- **Citations** — whether the business's website / GBP listing is cited as a source, and which domains AI trusts for this market (the "get mentioned here" targets).
- **Trend + alerts** — run-over-run movement with noise-aware change detection; "You lost your ChatGPT recommendation for 'emergency plumber san diego'" notifications.
- **What to do about it** — Plan steps generated from AI-visibility gaps, in the existing approve → publish → attribution loop.

### 2.2 Surfaces and how we measure them (all official APIs — no consumer-app scraping)

| Surface | Method | What we get | Cost basis (verify in Phase 0) |
|---------|--------|-------------|-------------------------------|
| **ChatGPT (proxy)** | OpenAI **Responses API** with the hosted `web_search` tool (existing `OPENAI_API_KEY`) | Answer text, cited URLs/domains, business names in answer | Per-call tool fee (~$10–25 / 1K searches) + tokens |
| **Gemini** | **Gemini API** `generateContent` with **Grounding with Google Maps** tool (+ optionally Google Search grounding) | Answer text + `groundingMetadata.groundingChunks` with **`placeId`** per recommended place — directly joinable to our Places rank data | ~$25 / 1K grounded prompts (Gemini ≤2.5) or ~$14 / 1K queries (Gemini 3); free tier ~500 req/day |
| **Google AI Overviews + AI Mode** | Third-party SERP API vendor (**DataForSEO** Google Organic Live Advanced with `load_async_ai_overview: true`, plus AI Mode endpoint; SerpApi as fallback vendor) | AI Overview presence, snippet text, `references` (cited sources), per geo location | ~$0.002–0.01 per SERP (DataForSEO) / ~$0.015 (SerpApi) |

Important honesty note (mirrors the existing "sampled Places visibility estimate" disclaimer): API probes are a **modeled estimate** of what consumer AI apps answer — personalization, memory, app-specific retrieval, and model routing differ. We label it as such everywhere ("Estimated AI answer visibility, sampled via official APIs"). This is the same posture every AI-visibility vendor (Profound, Keyword.com, Otterly) takes.

### 2.3 Prompt panel

Derived deterministically from existing data — no new user input required:

- Source keywords: `businesses.keywords` (already min 3, managed via `/api/business/keywords`), capped like `weeklyKeywordLimit` (start: top 3 by keyword revenue value from `keyword-portfolio.ts` / `keyword_revenue_monthly` when available).
- Per keyword, 2 prompt templates (start small; expand later):
  1. `best {keyword} in {city, state}` — discovery intent
  2. `who do you recommend for {keyword} near {neighborhood/city}?` — recommendation intent
- Location context passed natively where the API supports it (OpenAI `web_search` user location; Gemini Maps grounding lat/lng from the business's stored coordinates; DataForSEO `location_name`).
- Panel is stored (not recomputed ad hoc) so trends compare like with like; regenerated when keywords change, with old prompts retired (`active = false`), never deleted.

### 2.4 Metrics (per business × surface × run)

| Metric | Definition |
|--------|------------|
| **Mention rate** | prompts where the business is named ÷ prompts that produced an answer |
| **Recommendation position** | ordinal of the business when the answer lists options (1 = named first); null when unlisted |
| **Citation rate** | answers citing the business website domain or Maps listing ÷ answers with citations |
| **AI share of voice** | business mentions ÷ total distinct business mentions across the panel |
| **Answer trigger rate** (AIO only) | keyword-locale pairs where an AI Overview appeared at all |
| **Sentiment** | positive / neutral / negative framing of the mention (LLM-classified, existing `completeJson` pattern) |

Noise handling is a first-class design constraint: answers are nondeterministic even at fixed settings. We take **2 samples per prompt per run**, aggregate at the run level, report trends over the **last 3 runs / rolling ~45 days**, and require **two consecutive runs** to confirm a mention gained/lost before alerting (analogous to how center trends bridge and filter on `ranking_model`).

---

## 3. Architecture

Deliberately mirrors the rank-tracking pipeline so every pattern is familiar:

```
buildAiPromptPanel()                        # from businesses.keywords + coords
  → cron /api/cron/ai-visibility-probe      # UTC days 2 & 16 (offset from rank pulse days 1 & 15)
    → reserveAiProbeBudget()                # mirrors reserve_places_api_calls RPC + claims
    → providers: openaiChatgptProbe() | geminiMapsProbe() | aiOverviewProbe()
    → parseAnswer()                         # mentions, position, citations, competitors, sentiment
    → ai_answer_snapshots                   # raw per-probe rows (mirrors rank_snapshots)
    → rollupAiVisibility()                  # ai_visibility_runs + daily metrics
  → Results / Audit Data / Home UI
  → detectGaps() additions → Plan steps → execution → attribution (existing loop)
```

### 3.1 New code layout

| Path | Contents |
|------|----------|
| `src/lib/ai-visibility/types.ts` | `AiSurface` (`"openai_chatgpt" \| "gemini_maps" \| "google_ai_overview" \| "google_ai_mode"`), probe result / snapshot / rollup types |
| `src/lib/ai-visibility/prompt-panel.ts` | Deterministic panel builder + regeneration on keyword change (hook into `sync-tracked-keywords.ts`) |
| `src/lib/ai-visibility/providers/openai.ts` | Responses API `web_search` probe (extends `src/lib/llm/client.ts` config; new endpoint helper, keeps `isLlmConfigured()` pattern) |
| `src/lib/ai-visibility/providers/gemini.ts` | Gemini `generateContent` + Maps grounding client (new `GEMINI_API_KEY`) |
| `src/lib/ai-visibility/providers/serp.ts` | DataForSEO AI Overview / AI Mode client (new `DATAFORSEO_LOGIN` / `DATAFORSEO_PASSWORD`) |
| `src/lib/ai-visibility/parse-answer.ts` | Mention detection (name normalization reusing competitor-matching heuristics from `local-rankings.ts` / `parse-business-place.ts`), position extraction, citation domain matching, competitor extraction |
| `src/lib/ai-visibility/cost-governance.ts` | Budget reserve/release mirroring `places-cost-governance.ts` |
| `src/lib/ai-visibility/rollup.ts` | Run + trend aggregation, change confirmation logic |
| `src/lib/ai-visibility/storage.ts` / `storage-admin.ts` | User-scoped vs service-role access, matching the existing storage split |
| `src/jobs/ai-visibility-probe.ts` | Cron job implementation |
| `src/app/api/cron/ai-visibility-probe/route.ts` | Cron route (`verifyCronSecret`) |
| `src/app/api/ai-visibility/{summary,answers,refresh}/route.ts` | UI data + manual refresh (7-day cooldown like `MARKET_REFRESH_FLAGS.manualCooldownDays`) |
| `src/components/results/AiVisibilityPanel.tsx` + subcomponents | Results tab section |
| `src/components/audit/AiAnswerProbesTable.tsx` | Audit Data raw probes |

### 3.2 Data model — `supabase/migrations/041_ai_visibility.sql`

```sql
-- Prompt panel (stable identities for trend comparison)
create table ai_prompt_panel (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  keyword text not null,
  prompt_kind text not null,          -- 'best_in_city' | 'recommendation_near'
  prompt_text text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- Raw probe results (analog of rank_snapshots)
create table ai_answer_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  prompt_id uuid not null references ai_prompt_panel(id),
  run_id uuid not null,               -- groups one cadence run
  surface text not null,              -- AiSurface
  model text,                         -- e.g. 'gpt-5-mini', 'gemini-3-flash'
  sample_index smallint not null default 0,
  captured_at timestamptz not null default now(),
  answer_present boolean not null,    -- AIO may simply not trigger
  business_mentioned boolean not null,
  mention_position smallint,          -- null = not listed
  business_cited boolean not null default false,
  citations jsonb not null default '[]',      -- [{domain, url, title}]
  competitors jsonb not null default '[]',    -- [{name, position, placeId?, domain?}]
  sentiment text,                     -- 'positive' | 'neutral' | 'negative'
  answer_excerpt text,                -- capped ~2000 chars
  raw jsonb                           -- provider payload (pruned)
);

-- Run-level rollup (analog of grid_snapshots)
create table ai_visibility_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  run_date date not null,
  surface text not null,
  prompts_total int not null,
  prompts_answered int not null,
  prompts_mentioned int not null,
  avg_mention_position numeric,
  citation_rate numeric,
  share_of_voice numeric,
  ai_visibility_score numeric,        -- 0-100 keyword-value-weighted
  unique (business_id, run_date, surface)
);

-- Budget governance (analog of places monthly usage + claims)
create table ai_probe_monthly_usage ( ... business_id, month, probes_used, budget ... );
create table ai_probe_claims ( ... claim_key unique, status, expires_at ... );
```

Row-level security follows the existing per-business policies; service-role writes from cron only.

### 3.3 Scheduling and cost governance

- **Cadence:** twice monthly, UTC days **2 and 16** (`AI_VISIBILITY_FLAGS.probeDaysUtc = [2, 16]`) — one day after the rank pulse so AI results can be cross-referenced against fresh Maps ranks, and so the two systems never contend for the same cron window. New `vercel.json` entry: `/api/cron/ai-visibility-probe`, `0 8 2,16 * *`.
- **Volume per business per run:** 3 keywords × 2 prompts × 3 surfaces (ChatGPT, Gemini, AIO; AI Mode optional) × 2 samples = **36 probes/run, 72/month**. (AIO probes don't need 2 samples — SERPs are more stable — so realistic steady state is ~60/month.)
- **Budget:** `DEFAULT_AI_PROBE_MONTHLY_BUDGET = 80` per business, reserved/released through the claims pattern so serverless retries never double-spend (exactly like `market_collection_claims` + `reserve_places_api_calls`).
- **Estimated marginal cost per business per month** (to validate in Phase 0): OpenAI ~24 searches ≈ $0.30–0.70 incl. tokens; Gemini ~24 grounded prompts ≈ $0.60 (or free-tier while volume is low); DataForSEO ~12 SERPs ≈ $0.05–0.15. **Total ≈ $1–1.50/business/month** — small enough to include in every tier without a price change (see §7). Because it's on for everyone, aggregate cost scales linearly with the customer base, so the hard per-business budget below is the primary cost control.
- **Caching:** 6-hour response cache keyed by `(surface, prompt_text, location)` in a `ai_probe_cache` table or by extending `places_search_cache`'s pattern, so retries and audit views share responses.
- **Manual refresh:** budget-aware, 7-day cooldown, same UX contract as the market refresh button.
- **Kill switches:** `AI_VISIBILITY=0` disables everything; per-surface flags (`AI_VISIBILITY_SURFACES=openai,gemini,aio`) allow degrading gracefully when one provider misbehaves.

### 3.4 Answer parsing

1. **Mention detection:** normalize the business name (strip legal suffixes, punctuation — reuse/extract the name-normalization used for competitor identity matching) and search the answer text; also match the website domain and Maps URL in citations.
2. **Gemini is the anchor surface for identity:** `groundingMetadata.groundingChunks[].maps.placeId` gives exact Place IDs, joinable to `rank_snapshots` competitors and `competitor_profile_snapshots`. Text surfaces fall back to fuzzy name matching, with Gemini's placeId↔name pairs used as a per-market alias dictionary to improve ChatGPT/AIO matching over time.
3. **Position:** index of the business in the ordered list of distinct businesses as they first appear in the answer.
4. **Sentiment + structured extraction fallback:** when regex/name matching is ambiguous, one cheap `completeJson` call (existing pattern, `gpt-4o-mini`-class) classifies the answer: `{businesses: [{name, position}], targetMentioned, sentiment}`. This is an extraction call on our own stored text — cheap and deterministic-enough.

### 3.5 Scoring integration — deliberately parallel, not blended

- New **AI Visibility Score (0–100)**: keyword-value-weighted mention rate with a position bonus, computed in `rollup.ts`, snapshotted per run (and optionally mirrored into a nullable `score_daily.ai_visibility` column for the changelog UI).
- The **overall Reputation Boost Score formula does not change** (driver 70% / outcome 30% stays). Rationale: (a) the score must stay stable and comparable across the existing customer base while the new metric matures; (b) we have no calibration data yet linking AI mentions to calls/revenue. Revisit blending only after Phase 7 attribution data exists, via the existing learned-model machinery (`score_model_global`), never hardcoded.

---

## 4. UI plan

No fifth tab initially — slot into existing surfaces (per current tab architecture in `src/components/platform/types.ts`):

| Surface | Addition |
|---------|----------|
| **Results tab** (`ResultsView.tsx`) | New **"AI Answers"** section: per-surface cards (mention rate, trend sparkline, SoV), competitor leaderboard, expandable answer transcripts with highlighted mentions + citation chips, "cited domains in your market" list. Sits beside Maps outcomes / experiment results. |
| **Audit Data tab** (`AuditDataView.tsx`) | Raw probe table (prompt, surface, mentioned?, position, citations, timestamp) next to the rankings tables — the "show me the receipts" view. |
| **Home tab** (`HomeView.tsx`) | One tile: "AI recommends you for X of Y searches" with delta, linking to Results. |
| **Plan tab** | AI-visibility gap steps appear through the normal pipeline (§5) — no bespoke UI. |
| **Marketing** | Homepage section ("Who does AI recommend?") + feature row on all pricing tiers + FAQ entry (update `marketing-faq.ts`, which currently implies citations are out of scope — reword to distinguish NAP citations from AI answer citations). Candidate for the free preview audit funnel later (out of scope here — probes cost real money per anonymous visitor). |

Empty states: before the first probe run completes, the section shows a "first AI answer check runs on {date}" placeholder (same contract as businesses awaiting their first monthly grid).

Gemini attribution compliance: when showing Gemini-grounded content, display the required "Google Maps" source attribution per the grounding usage requirements (do not restyle/translate the string).

---

## 5. Plan / Autopilot integration

The levers that influence AI answers for local queries are mostly levers we already operate, because all three surfaces lean heavily on Maps data, reviews, and authoritative web mentions:

1. **New gap IDs** in `src/audit/phase2/gaps.ts`:
   - `ai_not_mentioned_money_keyword` (P1) — business absent from AI answers for a top-value keyword where a competitor with matching Maps presence *is* mentioned.
   - `ai_citation_gap` (P2) — AI cites sources for this market but never the business's website.
   - `ai_overview_absent_from_serp` (P3, informational) — AIO doesn't trigger for the keyword at all (nothing to fix; suppress noise).
2. **Step routing:** most `ai_not_mentioned` gaps resolve to **existing** steps (review velocity, category/services completeness, description keywords, photos, Q&A) with an added "also improves AI answer visibility" rationale line in the step copy — the LLM plan prompt (`gbp-plan.ts` / `llm/gbp-plan.ts`) gets AI-visibility context appended. Genuinely new steps (custom range ≥18, per existing convention):
   - **Website LocalBusiness schema + FAQ content** targeting the exact prompt phrasing (manual step with generated copy).
   - **Earn a mention on top-cited domains** — surfaces the specific domains AI cites in this market (from `citations` data) as outreach targets (manual step).
3. **Attribution:** published steps already flow through `action_attributions` 14-day windows; add AI mention deltas as an additional outcome column so Phase F-style calibration can eventually learn which steps move AI visibility (Phase 7, stretch).
4. **Notifications:** mention gained/lost (confirmed across two runs) reuses the autopilot notifications channel (`039_autopilot_notifications.sql` patterns).

---

## 6. Rollout phases

Recommended order: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7** (ship the tracker end-to-end before deep Plan integration; Plan work depends on observing real gap distributions). Rollout mechanism: `AI_VISIBILITY` master flag (default off) plus a temporary `AI_VISIBILITY_PILOT_BUSINESS_IDS` allowlist env var used during Phases 1–4; at Phase 4 exit the allowlist is removed and the flag is on for everyone. No per-business entitlement machinery is ever built.

### Phase 0 — Spike & validation (de-risk before any schema)

- `scripts/ai-visibility-spike.ts` (offline, not deployed): run the full prompt panel for ~10 real businesses across all three surfaces, twice a day for a week.
- Answer: mention-rate variance per surface (validates 2-sample + 2-run confirmation design), AIO trigger rate for local intents, Gemini placeId join quality vs. our `rank_snapshots` competitor place IDs, real per-probe cost, vendor choice for AIO (DataForSEO vs SerpApi — pick on parse quality of `references` for local queries).
- Exit criteria: measured run-over-run mention-rate standard deviation < ~15pp per surface with 2 samples (else raise samples or lengthen aggregation window before building), confirmed cost ≤ ~$2/business/month, vendor selected.

### Phase 1 — Foundation + ChatGPT surface (end-to-end, no UI)

- Migration `041_ai_visibility.sql`; types; `prompt-panel.ts` + keyword-change hook; cost governance; OpenAI provider; `parse-answer.ts`; rollup; cron route + `vercel.json` entry; flags (`AI_VISIBILITY` default off).
- Tests (node:test per repo convention): panel determinism, parser fixtures (mention/position/citation extraction against ~20 canned answers), budget claim idempotency, rollup math, cron auth.
- Acceptance: enabling the flag for a pilot business produces `ai_answer_snapshots` + `ai_visibility_runs` rows on schedule, within budget, idempotent under retry.

### Phase 2 — Gemini surface

- `providers/gemini.ts` (`GEMINI_API_KEY`), Maps grounding with business coordinates, placeId extraction into `competitors`, alias dictionary feeding the text-surface matcher.
- Tests: groundingMetadata parsing fixtures, placeId↔competitor join.

### Phase 3 — AI Overviews + AI Mode surface

- `providers/serp.ts` (DataForSEO creds), `load_async_ai_overview: true`, presence + `references` parsing, per-locale `location_name` from business city/state.
- Tests: AIO present/absent/async fixtures, reference domain matching.

### Phase 4 — Rollups, UI, manual refresh, general availability

- Results panel, Audit Data table, Home tile, `/api/ai-visibility/*` routes, manual refresh with cooldown, trend + confirmation logic, disclaimers.
- Acceptance: pilot businesses see populated UI; empty/loading/error states covered; no layout regressions in the four-tab shell.
- Exit: flip `AI_VISIBILITY` on globally — every business's next scheduled run (days 2/16) begins populating data. Backfill is not needed; the first run is the baseline.

### Phase 5 — Plan integration + notifications

- Gap IDs, step routing + copy context, custom steps (schema/FAQ, cited-domain outreach), mention-change notifications.
- Tests: gap detection fixtures (mentioned vs not vs AIO-absent), step ordering doesn't starve conversion-first NBA (respect existing prioritization invariants in `plan-prioritization.ts` tests).

### Phase 6 — Marketing & positioning

- Homepage section, pricing-page feature row across all tiers (`src/lib/pricing.ts`), FAQ update in `marketing-faq.ts`, onboarding copy mention ("we also check who ChatGPT and Google AI recommend").
- Optional: "AI visibility" teaser line in the free preview audit (static copy only — no live probes for anonymous visitors).

### Phase 7 — Closed loop (stretch)

- AI mention deltas in `action_attributions`; calibration of which steps move AI visibility; optional autopilot experiment type ("publish X, confirm AI mention within 2 runs"); revisit score blending with learned weights only if attribution shows AI mentions predict calls/revenue.

---

## 7. Pricing & packaging

- **Included in every tier** (Keyword $150, Omni $199, Spectrum $399) at no price change. Marginal cost is ~$1–1.50/business/month — negligible against tier prices — and standalone AI-visibility tools charge $99–300/mo for tracking alone, so bundling it is a strong competitive moat rather than lost revenue.
- No entitlement infrastructure is built; the only gate is the global `AI_VISIBILITY` env flag used for rollout. If packaging strategy changes later, gating can be added then — nothing in this design assumes it.
- Positioning line for marketing: *"Google Maps tells you where you rank. We also tell you who AI recommends — and fix both from one plan."*

---

## 8. Risks & mitigations

| Risk | Severity | Mitigation |
|------|----------|------------|
| Answer nondeterminism → noisy trends, false alerts | High | 2 samples/prompt, run-level aggregation, 2-run confirmation before alerting, rolling-window UI; Phase 0 measures variance before we commit |
| API answers ≠ consumer app answers | High (trust) | "Modeled estimate" labeling everywhere (mirrors existing Places-estimate disclaimer); show raw transcripts so customers can verify |
| Provider drift (models, response shapes, pricing) | Medium | Thin provider interface + per-surface kill switches; raw payloads stored for reparse; pinned model names in config |
| AIO vendor dependency (DataForSEO) | Medium | Vendor-agnostic `serp.ts` interface; SerpApi fallback validated in Phase 0 |
| AIO simply doesn't trigger for many local queries | Medium (perceived value) | Report trigger rate honestly; lean on ChatGPT/Gemini surfaces where an answer always exists |
| Cost creep as keyword panels grow | Medium | Hard monthly budget + claims (proven pattern); panel capped at top-value keywords |
| Name-match false positives/negatives (franchises, common names) | Medium | Gemini placeId anchor + alias dictionary; LLM extraction fallback; surface confidence in Audit Data |
| Fleet-wide cost since every business is included | Medium | Hard per-business monthly budget + claims; per-surface kill switches; global `AI_VISIBILITY` flag as emergency stop; monitor aggregate spend during pilot before GA |
| Gemini Maps attribution compliance | Low | Required "Google Maps" attribution component baked into the transcript UI |

## 9. Out of scope (this plan)

- Perplexity / Claude / DeepSeek surfaces (add later behind the same provider interface if customers ask).
- Per-business entitlement or billing gating (feature is core; the global env flag is the only switch).
- Live AI probes in the anonymous free preview audit (cost per visitor is unbounded; static teaser copy only).
- Blending AI visibility into the overall score (Phase 7 decision, data-driven).
- Multi-location/franchise orchestration (consistent with Plan roadmap out-of-scope).
- Content-publishing automation on third-party domains (we surface outreach targets; we don't do outreach).

## 10. New environment variables

```
AI_VISIBILITY=                      # master flag, default off until GA at Phase 4 exit
AI_VISIBILITY_PILOT_BUSINESS_IDS=   # temporary pilot allowlist, removed at GA
AI_VISIBILITY_SURFACES=             # e.g. "openai,gemini,aio" (default all)
GEMINI_API_KEY=
DATAFORSEO_LOGIN=
DATAFORSEO_PASSWORD=
AI_PROBE_MONTHLY_BUDGET=            # optional override, default 80
```

(`OPENAI_API_KEY`, `CRON_SECRET`, Supabase vars already exist.)
