# Reputation Boost

Modern marketing homepage for [Reputation Boost](https://reputationboost.com/) — an AI-powered local rankings and online visibility platform.

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
2. **Add business** at `/platform/onboard` — name, address, industry, keywords
3. **Connect Google** — OAuth with `business.manage` scope
4. **Select location** — if the account has multiple GBP locations
5. **Run audit** at `/platform/audit` — live GBP data, rankings, AI strategy, execution queue

OAuth tokens are stored per business in Supabase (not in env vars).

### Google Cloud setup

1. Create a project and enable:
   - **Google Business Profile APIs** (Account Management, Business Information, Performance, Q&A)
   - **Places API** + **Geocoding API** (for rankings)
2. Create **OAuth 2.0 Client** (Web application)
3. Authorized redirect URI: `https://your-domain.com/api/google/gbp/callback`
4. Apply for [GBP API access](https://developers.google.com/my-business/content/prereqs) if quota is 0

### Environment variables

```
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_MAPS_API_KEY=
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=   # same key, referrer-restricted — powers onboarding autocomplete
OPENAI_API_KEY=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app
```

Run migrations `001`, `002`, and `003` in the Supabase SQL Editor.

## Phase 1 Audit Engine

Automated monthly data collection for local business audits:

- **1A** — Google Business Profile (live via OAuth: performance, posts, Q&A, reviews)
- **1B** — Local 3-Pack rankings and geo-grid (1/3/5/10 mile) via **Google Places Nearby Search**
- **1C** — Competitor intelligence (top 5 per keyword, discovered from same Places result list)
- **1D** — Review sentiment and dispute candidates
- **1E** — Citation consistency and website signals

```bash
# Dashboard (requires sign-in + GBP connected)
open http://localhost:3000/platform/audit
```

Set `GOOGLE_MAPS_API_KEY` for live Local 3-Pack rankings.

### How rankings work

For each keyword and business address:

1. **Geocode** the address to lat/lng (skipped if coordinates are already on the client)
2. **Places Nearby Search** at 1, 3, 5, and 10 mile radii
3. **Rank** = position in Google's ordered result list (1-indexed); `null` = not found in that set
4. **Local 3-Pack** = rank ≤ 3 at the 1-mile radius
5. **Competitors** = other businesses in the same result list (not pre-registered)

This measures **Google Maps / Local Pack ordering**, not desktop organic web results. Nearby Search and Text Search can return different orderings for the same keyword.

```bash
# Places search proxy (requires sign-in)
curl "http://localhost:3000/api/places/search?keyword=plumber&radiusMiles=1" -H "Cookie: ..."
```

## Phase 2 — Scoring & Strategy

After Phase 1 data collection, the engine automatically:

- **Scores** GBP completeness, Local 3-Pack coverage, review strength, engagement, competitive gap (0–100)
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
- **Technical & citations** — schema markup and NAP fix tasks

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

- **Hero** — Headline, CTA, stats, and interactive dashboard preview
- **Features** — Get Data, Geo-Located Heatmap, Top Competitors, Customized Suggestions
- **How It Works** — Three-step flow with before/after rankings comparison
- **Testimonial** — Customer quote
- **CTA** — Get Free Account signup
- **Footer** — Navigation and links
