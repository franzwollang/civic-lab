# Civic Lab High-Fidelity Prototype

Thread-first Canon + Country Manuals prototype (Vite SPA + Hono API + Prisma/SQLite).

Product reference: `CONCEPT.md`. Roadmap: `PLANNING.md`. Open work: `OPEN_ISSUES.md`.

## Prerequisites

- Node 22+
- **pnpm 9.15.9** (`packageManager` in `package.json`; Volta/`corepack` OK)

## Setup

```bash
pnpm install
pnpm run dev          # Vite + Hono API (API on :8787)
```

API base (client default): `http://localhost:8787/api`  
Health: `GET http://localhost:8787/api/health`

## Verify green

```bash
pnpm run build
pnpm test:smoke       # DB + HTTP gate smokes (see scripts/smoke-*.ts)
```

## Useful scripts

| Script | Purpose |
|---|---|
| `pnpm run dev` | Client + API |
| `pnpm run dev:server` | API only (`tsx watch server/index.ts`) |
| `pnpm db:push` | Sync Prisma schema to SQLite |
| `pnpm db:seed` | Seed if empty (`-- --force` to wipe/reseed) |
| `pnpm test:smoke` | Full smoke suite |

Wipe local DB: `rm -f prisma/dev.db prisma/dev.db-journal && pnpm run dev`

## Cloud agents

1. Read `PLANNING.md` status board + **Residual phase** sequencing.
2. Pick the top unchecked item in `OPEN_ISSUES.md` with acceptance criteria.
3. After changes: `pnpm test:smoke` (must stay green). Prefer adding/extending a smoke for new API behavior — include at least one HTTP check via `app.request` when touching routes.
4. Update `OPEN_ISSUES.md` / `PLANNING.md` / `SCRATCHPAD.json` the same turn; append logs.
5. Do not force-push, rewrite history, or weaken tests to pass.
