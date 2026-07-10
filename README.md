# Reputation Boost

Marketing site and platform for [Reputation Boost](https://reputationboost.com/) — an AI-powered Google Business Profile audit, **Reputation Boost Score**, and local rankings platform.

**Live demo:** [reputationboost.vercel.app](https://reputationboost.vercel.app/) — search your business on the homepage for a free preview audit (no sign-in required).

Brand assets live in `public/` (app logo: `public/Logo.jpeg`).

## Tech Stack

- **Next.js 16** (App Router)
- **React 19**
- **Tailwind CSS 4**
- **TypeScript**

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the site.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run audit:run` | Deprecated — use platform UI |

## User Onboarding

Live users sign in and connect their own Google Business Profile:

1. **Sign up / sign in** at `/login`
2. **Add business** at `/platform/onboard` — search Google Maps (including service-area businesses without a storefront), confirm details, industry, keywords
3. **Connect Google** — OAuth with `business.manage` scope
4. **Select location** — if the account has multiple GBP locations
5. **Run audit** at `/platform/audit` — live GBP data, rankings, AI strategy, execution queue

OAuth tokens are stored per business in Supabase (not in env vars).

### Google Cloud setup

1. Create a project and enable:
   - **Google Business Profile APIs** (Account Management, Business Information, Performance)
   - **Places API** + **Geocoding API** (for rankings)
2. Create **OAuth 2.0 Client** (Web application)
3. Authorized redirect URI: `https://your-domain.com/api/google/gbp/callback`
4. Apply for [GBP API access](https://developers.google.com/my-business/content/prereqs) if quota is 0

### Environment variables

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

### Google Maps API keys (two uses)

| Variable | Used for | APIs to enable |
|----------|----------|----------------|
| `GOOGLE_MAPS_API_KEY` | Server: rankings, geocoding | Places API, Geocoding API |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Client: onboarding autocomplete | **Maps JavaScript API**, **Places API (New)** |

`ApiNotActivatedMapError` means **Maps JavaScript API** is not enabled — enable it in [Google Cloud Console → APIs & Services → Library](https://console.cloud.google.com/apis/library), then redeploy.

Restrict the public key by HTTP referrer:
- `https://reputationboost.vercel.app/*`
- `http://localhost:3000/*`

Run migrations `001`, `002`, and `003` in the Supabase SQL Editor.

## Phase 1 Audit Engine

Automated monthly data collection for local business audits:

- **1A** — Google Business Profile (live via OAuth: performance, posts, reviews)
- **1B** — Local 3-Pack rankings and geo-grid (1/3/5/10 mile) via **Google Places Nearby Search**
- **1C** — Competitor intelligence (top 5 per keyword, discovered from same Places result list)
- **1D** — Review sentiment and dispute candidates
- **1E** — Citation consistency and website signals

```bash
# Dashboard (requires sign-in + GBP connected)
open http://localhost:3000/platform/audit
```

### Places API cost controls

`src/lib/feature-flags.ts` tunes how aggressively the app collects Places visibility:

| Flag | Default | Effect |
|------|---------|--------|
| `dailyMultiRadius` | `false` | Deprecated; daily cron records the business-pin Text Search baseline |
| `weeklyKeywordLimit` | `3` | Weekly 25-point radial scans per business |
| `auditReuseWeeklyGridDays` | `7` | Audits reuse a stored radial scan instead of 25 live searches/keyword |
| `gridProfile` | `compact` | Legacy preference for pre-radial stored grids |

Radial Text Search requests use one result page (up to 20 businesses) and a minimal field mask
(`places.id`, `places.displayName`) to control API cost.

### How rankings work

For each keyword and business address:

1. **Geocode** the address to lat/lng (skipped if coordinates are already on the client)
2. Generate the business pin plus eight compass bearings at **1, 3, and 5 miles**
3. Run one-page **Places Text Search (New)** with location bias from each of the 25 origins
4. **Rank** = position in the API result list; `null` = not visible in the first 20 results
5. Aggregate median rank, top-three coverage, visible coverage, and best/worst rank per ring
6. Collect competitor details separately with Nearby Search

This is a sampled **Places visibility estimate**, not a guarantee of personalized Google Maps or
Local Pack ordering. Historical audits without `rankingModel: "radial_text_v2"` retain their
legacy business-pin radius semantics. Center trends bridge legacy 1-mile rows into the new
business-pin series; ring trends start a new baseline at the radial-v2 cutover so incompatible
measurements are not blended.

```bash
# Places search proxy (requires sign-in)
curl "http://localhost:3000/api/places/search?keyword=plumber&radiusMiles=1" -H "Cookie: ..."
```

## Phase 2 — Scoring & Strategy

After Phase 1 data collection, the engine automatically:

- **Scores** visibility (keyword-weighted rankings), conversion (profile trust), and revenue capture (0–100), blended into listing strength
- **Keyword score cards** per target keyword with impressions, revenue estimates, and suggested actions
- **Path to 70** projects score gains and estimated monthly revenue from prioritized gaps and plan steps
- **Attribution calibration** adjusts step score impacts from historical action outcomes when available
- **Daily score snapshots** recomputed on nightly ingest from live keyword ranks
- **Score changelog** shows day-over-day and audit-over-audit point changes with keyword context
- **Global calibration** aggregates outcomes across all customers to improve step impact estimates
- **Detects gaps** with P0–P3 priority (outside 3-Pack, review gaps, stale posts, etc.)
- **Diffs** month-over-month vs. prior audit
- **Generates** executive summary, KPI targets, and 30-day action plan with draft copy

With `OPENAI_API_KEY` set, strategy narratives and action draft copy are **AI-generated** from real audit data (falls back to templates if unavailable).

## Phase 3 — Execution & Approval Queue

After strategy generation, the engine builds an execution queue from the 30-day action plan:

- **Google Posts** — 4 monthly posts with localized copy
- **GBP optimization** — business description, photos/services checklist
- **Review responses** — draft replies for unresponded reviews
- **Review requests** — SMS template for happy customers
- **Technical** — schema markup tasks

Tasks that publish public content require approval. Approve individually or use **Approve All**, then **Run Approved** to execute (simulated until `GOOGLE_BUSINESS_API_KEY` is wired).

With `OPENAI_API_KEY`, Google Posts, GBP descriptions, and review responses are **AI-written** from audit context.

```bash
# List tasks for current audit
curl http://localhost:3000/api/execution?clientId=san-diego-stucco&auditId=2026-07-02

# Approve a task
curl -X PATCH http://localhost:3000/api/execution/{taskId} \
  -H "Content-Type: application/json" \
  -d '{"status":"approved"}'

# Execute an approved task
curl -X POST http://localhost:3000/api/execution/{taskId}
```

Run `supabase/migrations/002_execution_queue.sql` in the Supabase SQL Editor after migration 001.

## Supabase Auth

Protected routes: `/platform/*`, `/api/audit/*`, `/api/execution/*`, `/api/places/*`, `/api/business`, `/api/google/gbp/connect`

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` → `.env.local` and add your URL + anon key
3. Run migrations in order via the Supabase SQL Editor:
   - `supabase/migrations/001_initial_schema.sql`
   - `supabase/migrations/002_execution_queue.sql`
   - `supabase/migrations/003_gbp_oauth.sql`
4. In Supabase **Authentication → URL Configuration**, set:
   - Site URL: `http://localhost:3000` (or your Vercel URL)
   - Redirect URLs: `http://localhost:3000/auth/callback`, `https://your-domain.vercel.app/auth/callback`
5. Sign in at `/login` to access `/platform/audit`

## Page Sections

- **Hero** — Business search with instant free preview audit
- **Platform explorer** — Live map, score, and action plan after search
- **How It Works** — Nightly score loop and continuous improvement flywheel
- **ROI calculator** — Revenue opportunity estimate
- **Pricing & FAQ** — Plans and common questions
- **CTA & footer** — Signup and navigation
