# AnchorProposal - AI Resume & Application Tracking Platform

Multi-user platform for AI-assisted resume tailoring and job application management.

## Tech Stack

- **Frontend:** Next.js 15, TypeScript, Tailwind CSS, Recharts
- **Backend:** NestJS, Prisma ORM, BullMQ
- **Database:** PostgreSQL 16
- **Queue:** Redis 7 + BullMQ
- **AI:** DeepSeek API
- **Monorepo:** npm workspaces + Turborepo

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm (`corepack enable`)
- PostgreSQL 16 and Redis 5+ (or Memurai on Windows)
- Optional: Docker Desktop (requires WSL2 + reboot after first install)

### Setup

```bash
# 1. Install dependencies (from repo root)
cd D:\tailor
pnpm install

# 2. Build shared package
pnpm --filter @anchorproposal/shared build

# 3. Generate Prisma client and migrate
cd apps/api
pnpm exec prisma generate
pnpm exec prisma migrate deploy
pnpm exec ts-node --transpile-only prisma/seed.ts
cd ../..

# 4. Start API
cd apps/api
pnpm exec tsc -p tsconfig.json
node dist/main.js

# 5. Start Web (new terminal)
cd apps/web
pnpm dev
```

Or from root: `pnpm dev` (starts web + api in parallel once scripts are configured)

- **Web:** http://localhost:3000
- **API:** http://localhost:3001

### Docker Compose (after reboot)

Docker Desktop + WSL2 were installed but need a **Windows restart** before the Docker engine can start.

After reboot:
```bash
docker compose up -d
```

### Demo Accounts

| Role   | Email / username              | Password      |
|--------|-------------------------------|---------------|
| Master | Master                        | Master@12345  |
| Admin  | admin@anchorproposal.com      | admin123      |
| Bidder | bidder@anchorproposal.com     | bidder123     |

**Roles:** Master manages users and platform analytics (no bidding). Admin bids and manages their own bidders, profiles, templates, and prompts. Bidder bids using assigned profiles and published templates only.

Sign-in uses email and password. Sign-up still requires a **6-digit email OTP** (logged to the API console when SMTP is not configured). New self-registered users start as **Pending** until Master/Admin allows them.

## Trial / share with QA (ngrok)

Several users on other machines can log in over one ngrok HTTPS URL. Auth uses Bearer tokens + same-origin `/backend` proxy — **no per-IP setup**.

**Never run `pnpm dev` while sharing.** Dev web serves a ~7MB JS bundle; browsers and free ngrok fail, and login ends on `/login?`. Use share mode only.

### Start trial mode (local + remote)

```powershell
# From repo root — kills next/api on 3000/3001, starts API + production web, smoke-tests login
pnpm share

# Separate terminal (IPv4 required on Windows — do not use bare "localhost")
ngrok http 127.0.0.1:3000
# Or: ngrok start --config ngrok.yml --all
```

- **You (host):** open `http://127.0.0.1:3000` (prefer this over `localhost` on Windows)
- **Testers:** open the ngrok **HTTPS** URL, click through the free interstitial once, hard-refresh (Ctrl+Shift+R) once, then sign in with a demo account above

`pnpm dev` is for **local coding only** (no ngrok). For QA/trial hosting always use `pnpm share`.

### Env for the public URL

In `apps/api/.env` (and root `.env`), set your current ngrok HTTPS origin:

```env
APP_WEB_URL=https://YOUR-SUBDOMAIN.ngrok-free.dev
CORS_ORIGIN=https://YOUR-SUBDOMAIN.ngrok-free.dev,http://localhost:3000,http://127.0.0.1:3000
NEXT_PUBLIC_API_URL=/backend
API_PROXY_TARGET=http://127.0.0.1:3001
```

Restart the API after changing `APP_WEB_URL` / `CORS_ORIGIN`.

### QA checklist

1. Keep **API (3001)**, **production web (127.0.0.1:3000)**, and **ngrok** running — do not start `pnpm dev`.
2. Testers open the **HTTPS** ngrok URL and click through the free ngrok interstitial once.
3. Sign in with a demo account above.
4. In DevTools → Network, login should be `POST /backend/auth/login` on the **same** ngrok host (not `localhost:3001`).
5. If login breaks again, you likely started `pnpm dev` — run `pnpm share` again.
6. If the ngrok URL changes, update `APP_WEB_URL` / `CORS_ORIGIN` and restart the API.

## Project Structure

```
apps/
  web/          Next.js frontend
  api/          NestJS backend + BullMQ worker
packages/
  shared/       Shared types, enums, Zod schemas
```

## Key Features

- Admin/Bidder role-based access control
- Candidate profile management with assignments
- Manual application entry with policy validation
- Duplicate company detection
- Configurable warning rules (clearance, remote, etc.)
- Async AI resume **and cover letter** generation via DeepSeek (JSON → PDF/DOCX using the chosen template)
- Master/Admin configure DeepSeek API key and model under Settings → AI Provider
- Master creates and publishes the initial prompt under Settings (no auto-seed); prompt must request both `resume` and `coverLetter` JSON
- PDF, DOCX, and TXT document output
- Resume template designer with live preview
- Application status tracking with timeline
- Audit logging

## Environment Variables

See `.env.example` for all configuration options.

## API Endpoints

- `POST /auth/login` - Sign in
- `GET /dashboard/metrics` - Dashboard KPIs
- `GET /applications` - List applications
- `POST /applications/:id/generations` - Start resume generation
- `GET /documents/:fileId/download` - Download generated file

## Job Pool

Job Pool pages are UI-only placeholders. Backend integration is planned for a future release.
