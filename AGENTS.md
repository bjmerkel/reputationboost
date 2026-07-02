<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

- Single service: a Next.js 16 (App Router, Turbopack) static marketing site. No backend, database, or env vars are required.
- Standard commands live in `README.md`/`package.json`: `npm run dev` (port 3000), `npm run build`, `npm run lint`.
- The startup update script already runs `npm install`, so dependencies are ready — just start the dev server.
- `next dev` uses Turbopack; the browser's rotating-cube overlay on navigation is the dev route-transition indicator, not an error.
