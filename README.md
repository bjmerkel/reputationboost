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
| `npm run audit:run` | Run Phase 1 audit (CLI / cron) |

## Phase 1 Audit Engine

Automated monthly data collection for local business audits:

- **1A** — Google Business Profile snapshot (identity, completeness, content, engagement, performance)
- **1B** — Local 3-Pack rankings and geo-grid (1/3/5/10 mile)
- **1C** — Competitor intelligence (top 5 per keyword)
- **1D** — Review sentiment and dispute candidates
- **1E** — Citation consistency and website signals

```bash
# Run monthly audit for demo client
npm run audit:run -- --client=san-diego-stucco --trigger=monthly

# Dashboard
open http://localhost:3000/platform/audit

# API
curl -X POST http://localhost:3000/api/audit -H "Content-Type: application/json" -d '{"clientId":"san-diego-stucco"}'
```

Set `GOOGLE_BUSINESS_API_KEY` and `RANK_TRACKER_API_KEY` for live API collectors (stubs included).

## Supabase Auth

Protected routes: `/platform/*`, `/api/audit/*`

1. Create a project at [supabase.com](https://supabase.com)
2. Copy `.env.example` → `.env.local` and add your URL + anon key
3. Run the migration in `supabase/migrations/001_initial_schema.sql` via the Supabase SQL Editor
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
