# Code review — Reputation Boost

Review of the current `main` codebase: an AI-powered Google Business Profile audit, scoring, ranking, and execution platform. Findings are ordered by severity. Line numbers refer to this revision.

## What this product actually is

The marketing site sells a **Maps ranking and listing-operations platform**, not a generic reputation tool:

1. Free homepage preview audit (no sign-in)
2. GBP OAuth connect → live audit (profile, ranks, competitors, reviews)
3. A 0–100 headline score (70% profile strength / 30% ranking outcome)
4. An approval-gated execution queue (posts, photos, descriptions, review replies)
5. SMS/email review outreach with geo targeting
6. A nightly ingest loop that rescores and attributes results

That gap between the name and the product is the branding problem at the end of this review. The engineering is substantially further along than the README suggests.

## What’s strong

- Scoring is explicit, tested, and documented. The 70/30 driver/outcome blend in `src/audit/phase2/score-driver-outcome.ts` is applied again at display time in `src/lib/scores/resolve-display-scores.ts`, so the headline number cannot drift from the two sub-scores the UI shows.
- Tenant reads generally go through `getUser()` plus `user.id` filters (`getActiveBusiness`, `getExecutionTask`, `getBusinessRecord`). That is the right pattern.
- Cron jobs fail closed in production when `CRON_SECRET` is missing (`src/lib/cron/route.ts`).
- Twilio inbound SMS verifies signatures. Email unsubscribe tokens are signed and HTML-escaped.
- There is real unit coverage around scoring, plan/execution, GBP helpers, and outreach (~200 test files). Admin impersonation has a write guard for viewer-level roles.

---

## High

### 1. Homepage search calls login-gated Places APIs

`GoogleBusinessAutocomplete` is the homepage CTA. For service-area businesses and generic categories it calls:

- `POST /api/places/resolve-location`
- `POST /api/places/category`

Both sit under `/api/places`, which middleware treats as protected and redirects anonymous users to `/login`:

```6:13:src/lib/supabase/middleware.ts
const PROTECTED_PREFIXES = [
  "/admin",
  "/platform",
  "/api/admin",
  "/api/audit",
  "/api/execution",
  "/api/places",
```

The client swallows non-OK responses. Storefront listings still work (Maps JS already returned lat/lng). Service-area businesses with no coordinates keep `lat = 0`, `lng = 0`. Preview-audit only rejects non-finite numbers, so a Gulf of Guinea audit can run against the public conversion funnel.

**Fix:** Split public, rate-limited geocode/category helpers from the authenticated Places search used in the dashboard. Reject `lat/lng` of `0,0` in preview-audit.

### 2. GBP Pub/Sub receiver is unauthenticated when the env token is unset

```61:69:src/app/api/webhooks/gbp/pubsub/route.ts
export async function POST(request: Request) {
  const token = process.env.GBP_PUBSUB_VERIFICATION_TOKEN?.trim();
  if (token) {
    const auth = request.headers.get("authorization");
    const queryToken = new URL(request.url).searchParams.get("token");
    if (auth !== `Bearer ${token}` && queryToken !== token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
```

If `GBP_PUBSUB_VERIFICATION_TOKEN` is missing in production, anyone can POST a fake envelope. The handler then (when the service role is configured) attributes reviews, syncs Google updates, persists GBP events, and enqueues rank pulses. Fail closed: require the token in production, same pattern as cron.

GET also echoes any `challenge` query param with no auth. That is the Pub/Sub handshake, but it should still be token-gated.

---

## Medium

### 3. Preview-audit rate limit is per-instance memory

`src/lib/rate-limit.ts` keeps a `Map` in process. On Vercel that is one bucket per isolate, so the advertised 8 previews/hour/IP does not hold. This endpoint spends Places + ranking quota. Use Redis/Upstash, or Vercel KV, keyed by IP.

`getClientIp` trusts `x-forwarded-for` first-hop. Confirm the platform overwrites that header; otherwise the limit is trivial to bypass even on one instance.

### 4. Webhook tokens are plaintext and accepted on the query string

Tokens are `wb_` + 24 random bytes, stored in `businesses.webhook_token`, looked up with the service role (`src/lib/integrations/webhook-storage.ts`). `extractWebhookToken` prefers `?token=`.

Consequences:

- A DB dump or compromised service role exposes every integration secret.
- Query-string tokens land in CDN logs, Vercel logs, and referrer headers.
- A stolen token can upsert customers and, if `autoSend` is on, send SMS/email.

Prefer `Authorization` / `X-Webhook-Token` only, store a hash, and show the raw token once at creation/rotation.

### 5. GBP OAuth callback trusts the cookie and puts location PII in the URL

`src/app/api/google/gbp/callback/route.ts` never re-checks the signed-in user against `parsed.userId`. The httpOnly state cookie is the only binding. Re-verify `getUser().id === parsed.userId` before writing tokens.

When auto-connect fails, ranked locations (names, addresses, phones) are base64-encoded into the redirect query string. That hits access logs, history, and referrers, and can blow URL length limits. Store the payload server-side (short-lived row or encrypted cookie) and pass an id.

OAuth errors are also reflected into `?error=` via `encodeURIComponent(message)`, which can leak Google/API internals to the browser.

### 6. Media-host HMAC falls back to the service-role key

```2:12:src/lib/google/gbp-media-host.ts
function hostSecret(): string {
  const secret =
    process.env.GBP_MEDIA_HOST_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.GBP_OAUTH_CLIENT_SECRET;
```

A 10-minute signed URL for a preview image should not share a secret with database superuser access. Require `GBP_MEDIA_HOST_SECRET` in production.

### 7. Impersonation swaps in the service-role client

When an admin impersonates, `createClient()` in `src/lib/supabase/server.ts` returns `createAdminClient()`, which bypasses RLS. Safety then depends on every query still filtering by the impersonated `user.id`. One missed filter is a cross-tenant read/write. Prefer a user-scoped client for the impersonated id, and keep service role for explicit admin APIs.

The impersonation cookie is unsigned JSON. Middleware’s `readImpersonationFromRequest` does not check admin role (the data path does). Sign the cookie or drop it in favor of a server session.

### 8. Middleware matcher and handler auth have drifted

`src/middleware.ts` protects a subset of `/api/*`. Metrics, autopilot, revenue, attribution, review campaigns, GBP reviews/posts/place-actions, and nested `/api/customers/import/[jobId]` are **not** in the matcher. Those handlers do call `getUser()`, so this is defense-in-depth, not an open door today — but new routes copied from neighbors will ship unprotected at the edge. Collapse to a default-deny for `/api/*` with an allowlist for webhooks, cron, auth, preview, and profile-guide events.

### 9. Public Profile Guide analytics always returns `{ ok: true }`

`src/app/api/profile-guide/events/route.ts` swallows insert failures and has no rate limit. Failures are invisible; the table is a spam sink. Rate-limit by IP + `guideId`, and return 204 vs 4xx honestly (keep 2xx only on success if you need sendBeacon compatibility, but log failures).

### 10. API errors echo internal exception messages

Many routes do `error instanceof Error ? error.message : "…"`. That is useful in development and leaky in production (Supabase, Google, Twilio). Map to stable client errors; log the original server-side.

---

## Low

### 11. `npm test` includes a non-test module

`package.json` `"test"` lists `src/lib/google/gbp-update-helpers.ts` among `*.test.ts` files. Node’s test runner will load it as a test file (zero tests). Easy to copy-paste again; drop it from the list.

### 12. README and FAQ are stale relative to the product

- README documents migrations `001`–`003`; the repo has 59.
- README still talks about simulated execution until `GOOGLE_BUSINESS_API_KEY` is wired; execution uses GBP OAuth.
- FAQ “What’s the difference between the three plans?” names Omni ($199) and Spectrum ($399) but omits Keyword Plan ($150) from `src/lib/pricing.ts`.

### 13. Active-business cookie is set from any `?businessId=` on `/platform`

Middleware writes `ACTIVE_BUSINESS_COOKIE` without checking ownership. `getActiveBusiness` later ignores unknown ids, so this is not IDOR — just a sticky cookie an attacker can set for a victim who later owns that id. Validate before writing.

### 14. No route-level or E2E tests

Scoring and GBP helpers are well tested. ~113 `route.ts` files have almost no HTTP tests (cron verify and plan reconcile excepted). OAuth callback, webhook POST, Twilio, Pub/Sub, and middleware impersonation are untested at the boundary where the high/medium issues live.

---

## Suggested fix order

1. Fail closed on GBP Pub/Sub auth in production.
2. Give the homepage public, rate-limited category/geocode endpoints; reject `0,0` in preview-audit.
3. Move preview-audit limiting off in-memory maps.
4. Stop accepting webhook tokens on the query string; hash at rest.
5. Re-check session on GBP OAuth callback; stop putting locations in the URL.
6. Dedicated `GBP_MEDIA_HOST_SECRET`; default-deny API middleware.

---

## Three names instead of Reputation Boost

### Why the current name fights the product

“Reputation Boost” reads as **review generation / star-rating inflation**. That is a crowded, low-trust category (and adjacent to Google’s review-gating rules). This codebase is not that product. The differentiators are:

- Local 3-Pack position across a service-area grid
- A nightly listing-health score, not a one-shot PDF
- Approval-gated GBP execution
- Calls / directions / revenue attribution

The company name and the metric also collide: “Reputation Boost” vs “Reputation Boost Score” vs `reputationboost.com`. A rename should leave room for “Your {Name} Score” without repeating the company.

### 1. Pinwise

**Score:** Pinwise Score

The asset is the Google Maps pin. “Pinwise” sounds like a product, not a growth hack, and it does not sit next to Reputation.com / Podium / Birdeye. Two syllables, easy on a call with an HVAC owner. Works for the nightly number (“your pin is a 62”) and for the ops platform around it.

`pinwise.com` is registered.

### 2. Packlift

**Score:** Packlift Score

Names the outcome the sales pitch already uses: get into, or stay in, the Local 3-Pack. “Lift” is about rank movement, not review volume. Pairs cleanly with geo-grid language already in the UI (cells, radii, pack leader). Slightly more coined than Pinwise; stronger if the company wants to own “the pack” as a category word.

`packlift.com` is registered.

### 3. Mapmeter

**Score:** Mapmeter Score

Leans into the loop that actually separates this from BrightLocal-style one-time audits: measure the listing every night, show what moved, point at the next action. Immediately understandable. Slightly more “tool” than “brand,” which is a feature if the score is the wedge (homepage CTA is already “Get your free score”).

`mapmeter.com` is registered.

### 10 more with unregistered `.com` domains

Checked against Verisign’s `.com` RDAP (HTTP 404 = not in the registry). Confirm at a registrar before buying — unregistered names can still be registry-premium priced. Grab soon if you like one.

| Name | Domain | Score name | Why |
|---|---|---|---|
| **Lucidpin** | lucidpin.com | Lucidpin Score | Clearest brand of the set. The Maps pin, made obvious. Premium, not spammy. |
| **Honestpin** | honestpin.com | Honestpin Score | Trust positioning vs review mills. Says you measure the listing, not juice stars. |
| **Mapswise** | mapswise.com | Mapswise Score | Closest available cousin to Pinwise. About Maps, not “reputation.” |
| **Mapsgrade** | mapsgrade.com | Mapsgrade | Score-first. Homepage CTA can stay “Get your free Mapsgrade.” |
| **Mapsmeter** | mapsmeter.com | Mapsmeter Score | Nightly measurement loop, with a free `.com` (mapmeter.com is taken). |
| **Radiuspack** | radiuspack.com | Radiuspack Score | Product-specific: 1/3/5-mile radii + Local 3-Pack. Hard to confuse with anything else. |
| **Packbeacon** | packbeacon.com | Packbeacon Score | Visibility in the pack — being found, not “boosted.” |
| **Packthree** | packthree.com | Packthree Score | Literal Local 3-Pack. Clunkier, but nobody misses what you do. |
| **Visiblepin** | visiblepin.com | Visiblepin Score | The outcome in plain English: make the pin show up. |
| **Nightlypin** | nightlypin.com | Nightlypin Score | Names the differentiator vs one-shot PDF audits. A bit long; very on-product. |

Skipped `pinmeter.com` (also free) because “pin meter” is already a moisture-meter category.

### How to use a new name

Keep **Profile Guide** as the public `/g/[slug]` sub-product. Rename the company and the headline metric together, and keep “profile strength” / “ranking outcome” as the two driver labels — those already make sense without the old brand.
