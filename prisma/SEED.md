# Seed vs runtime (M1)

## What lives where

| Path | Role |
|---|---|
| `prisma/seed/*.json` | **Seed-only** fixtures (former `db/*.json`). Edit these to change the default corpus. |
| `prisma/dev.db` | **Runtime** SQLite file (gitignored). Created on first startup. |
| `prisma/schema.prisma` | Schema; prototype uses `prisma db push` (no migration history yet). |
| `SeedMeta` table | Marker that seed was applied. If missing ⇒ DB treated as empty ⇒ re-seed. |

## Startup sequence (`pnpm run dev` → API)

1. Create `prisma/dev.db` if missing.
2. `prisma db push` (sync schema).
3. If no `SeedMeta` row ⇒ load JSON from `prisma/seed/` and write `SeedMeta`.
4. Express serves `/api/*` via Prisma.

## Common ops

```bash
# Normal: push + seed-if-empty happens when the API starts
pnpm run dev

# Manual schema sync
pnpm db:push

# Seed only if empty
pnpm db:seed

# Wipe runtime data and re-apply seed JSON
pnpm db:seed -- --force
# or delete the DB file:
rm -f prisma/dev.db prisma/dev.db-journal && pnpm run dev
```

## Adding a seed file

1. Add or edit JSON under `prisma/seed/` (keep shapes: pages array, revisions array, terms/attributions `{ version, items }`).
2. Reset runtime (`pnpm db:seed -- --force` or delete `prisma/dev.db`) so `SeedMeta` is cleared and startup re-seeds.
3. Empty re-seed is **intentional** for this local prototype — disposable data, not production migration.

## API contract

Response shapes stay snake_case (`page_id`, `content_json`, …) matching the previous JSON files so `/test/editor` and `/test/preview` keep working.
