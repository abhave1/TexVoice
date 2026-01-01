# Tex Intel API

Voice AI integration API for Tex Intel heavy equipment rental business — integrates with Vapi for voice calls, tools, and analytics.

## Features
- Customer recognition and personalized greetings
- Inventory search via tool calls
- Config-as-code for Vapi tools/assistants
- Call logging and billing analytics
- Test suite covering core logic
- Fastify + TypeScript implementation

## Quick Start

1. Install dependencies
```bash
npm ci
```

2. Configure environment
```bash
cp .env.example .env
# Edit .env and set required values (see Environment Variables below)
```

3. Start (dev)
```bash
npm run dev
```

4. Build & run (production)
```bash
npm run build
npm run start
```

5. Expose locally (webhook testing)
```bash
npm run tunnel
# Copy the HTTPS URL ngrok prints and use it in Vapi webhook settings
```

6. Sync tools to Vapi
```bash
npm run vapi:sync
```

## Project Structure
- app.ts — application entry and server setup
- controllers — request/response handling
  - inbound.controller.ts
  - tools.controller.ts
  - admin.controller.ts
  - client.controller.ts
- services — business logic
  - vapi-client.service.ts
  - database.service.ts
  - inventory.service.ts
  - customer.service.ts
- config
  - tools-builder.ts
  - assistant-config.ts
  - structured-output-id.json
  - tool-ids.json
- schema.sql — SQLite schema
- public — dashboard and static frontend (e.g., client.html, dashboard.css, client.js)
- tests — Vitest test suites
- sync-vapi.ts — sync helper for Vapi

## API (select)
- `GET /api` — health & endpoints
- `POST /inbound` — Vapi inbound webhook handling
- `POST /tools` — tool execution endpoint
- Admin: `/admin/calls`, `/admin/billing`, `/admin/tools`, `/admin/assistants`, `/admin/phone-numbers`, `/admin/health`
- Dashboard served at `/` (static public)

## NPM Scripts
- `npm run dev` — run with `tsx` watch (development)
- `npm run build` — compile TypeScript
- `npm run start` — run compiled app.js
- `npm run clean` — remove dist
- `npm run tunnel` — run ngrok tunnel
- `npm test` / `npm run test:watch` / `npm run test:ui` / `npm run test:coverage`
- `npm run vapi:sync` — sync tools/assistants to Vapi

(See package.json for exact versions and scripts.)

## Environment Variables
Required
- `VAPI_API_KEY` — Vapi server API key (used by vapi-client.service.ts)
Recommended
- `SERVER_URL` — externally reachable server URL used when building tool server callbacks (defaults to `http://localhost:3000`)
- `PORT` — server port (default 3000)
- `HOST` — server host (default `0.0.0.0`)
Optional
- `NODE_ENV` — `production` / `development`
- `DATABASE_PATH` — optional path for SQLite DB file (see Database notes)

## Database (important)
- The app currently uses SQLite by default and creates calls.db in the project root via database.service.ts.
- Filesystem-backed SQLite is fine for local development and tests (tests use in-memory DB), but most cloud hosts (including Railway) use ephemeral filesystems by default — the DB file can be lost on redeploy/scale.
Recommendations:
- Production: migrate to a managed Postgres instance (Railway Postgres plugin) and update code to use Postgres (or a migration layer).
- Quick deploy on Railway: either mount a Railway persistent disk and set `DATABASE_PATH` to the mounted path (e.g. `/data/calls.db`) or accept ephemeral storage for non-critical data.
- Optional small change: make SQLite path configurable by `DATABASE_PATH` (you can patch database.service.ts to read `process.env.DATABASE_PATH`).

## Deployment (Railway)
Minimal steps (UI)
1. Push your repo to GitHub.
2. Create a new Railway project → Deploy from GitHub → pick repo & branch.
3. In Railway Environment variables add:
   - `VAPI_API_KEY`, `SERVER_URL` (optional), `NODE_ENV=production`
4. Set Build & Start:
   - Build Command: `npm ci && npm run build`
   - Start Command: `npm run start`
Railway notes:
- Railway exposes `PORT` automatically; app.ts reads it.
- If you keep SQLite, either mount a persistent disk and set `DATABASE_PATH` or use Railway Postgres.

Railway CLI quick commands
```bash
npm i -g railway
railway login
railway init
railway variables set VAPI_API_KEY=sk_live_xxx SERVER_URL=https://your-domain railway
railway up
```

## Testing
Run all tests:
```bash
npm test
```
Tests live under tests and initialize the DB in-memory for isolation.

## Troubleshooting
- Server won't start: ensure .env exists and `VAPI_API_KEY` is set; run `npm ci` then `npm run build` then `npm run start`.
- Vapi issues: confirm `VAPI_API_KEY`, and webhook URL (ngrok or your deployed domain) is correct.
- Data disappearing on cloud deploy: check DB strategy (use persistent disk or Postgres).

## Contributing / Extending
- Add new tools in tools-builder.ts and sync via `npm run vapi:sync`.
- Add services in services and expose them through controllers in controllers.
- Write tests in tests and run `npm test`.

## Notes & TODOs
- Optional: patch database.service.ts to respect `DATABASE_PATH` for easier cloud deployment.
- Remove or create any missing reference docs previously mentioned in the old README (e.g., VAPI_GUIDE.md, TESTING.md) if you want to keep them referenced.