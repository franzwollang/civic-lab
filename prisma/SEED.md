# Seed vs runtime (M1 + M4 corpus)

## What lives where

| Path | Role |
|---|---|
| `prisma/seed/*.json` | **Seed-only** fixtures (former `db/*.json` + M4 Area/Collection/Dossier). Edit these to change the default corpus. |
| `prisma/dev.db` | **Runtime** SQLite file (gitignored). Created on first startup. |
| `prisma/schema.prisma` | Schema; prototype uses `prisma db push` (no migration history yet). |
| `SeedMeta` table | Marker that seed was applied. If missing ⇒ DB treated as empty ⇒ re-seed. |

## M4 hierarchy seeds

| File | Entities |
|---|---|
| `areas.json` | `area-canon`, `area-manuals` |
| `collections.json` | `collection-canon` (singleton); Manuals `collection-us/ca/gb/de` |
| `dossiers.json` | Canon `electoral-1`, `alignment-1`; Manuals `us-voting-1`, `ca-elections-1`, `gb-elections-1`, `de-elections-1` |
| `pages.json` | Artifacts with optional `dossier_id` (Canon `page-001`; US `us-*`; CA/GB/DE Manual stubs) |

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

1. Add or edit JSON under `prisma/seed/` (shapes: areas/collections/dossiers arrays; pages array with optional `dossier_id`; revisions array; terms/attributions `{ version, items }`).
2. Reset runtime (`pnpm db:seed -- --force` or delete `prisma/dev.db`) so `SeedMeta` is cleared and startup re-seeds.
3. Empty re-seed is **intentional** for this local prototype — disposable data, not production migration.

## API contract

- Corpus: `/api/areas`, `/api/collections`, `/api/dossiers` (+ nested dossier artifacts).
- Documents: Prisma `Artifact` / `ArtifactRevision` mapped onto legacy tables
  `pages` / `page_revisions` (`page_id` column ≡ artifact id). Wire JSON dual-emits
  `artifact_id` + `page_id`; `/api/artifacts` preferred (legacy `/api/pages` works).
