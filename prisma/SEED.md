# Seed vs runtime

## What lives where

| Path | Role |
|---|---|
| `prisma/seed/*.json` | **Seed-only** fixtures. Edit these to change the default corpus. |
| `prisma/dev.db` | **Runtime** SQLite (gitignored). Created on first startup. |
| `prisma/schema.prisma` | Schema; prototype uses `prisma db push` (no migration history). |
| `SeedMeta` table | Marker that seed was applied. Missing ⇒ DB treated empty ⇒ re-seed. |

## Seed files (by milestone)

| File | Entities |
|---|---|
| `areas.json` | `area-canon`, `area-manuals` |
| `collections.json` | Canon singleton; Manuals `collection-us/ca/gb/de` |
| `dossiers.json` | Canon + Manual dossiers (incl. governance/Charter home) |
| `pages.json` | Artifacts (`dossier_id`, Manual `lane`, `owner_merge_only`) |
| `page_revisions.json` | ArtifactRevision bodies (`content_json`, hashes) |
| `threads.json` | Threads + nested `posts` / `targets` |
| `revsets.json` | Leaf RFC proposal RevSets |
| `claims.json` | Empirical + requirement claims (incl. resolved forecasts for metrics) |
| `findings.json` | Red Team Findings + targets (M7) |
| `candidates.json` | CandidateFindings for promote flow (M7) |
| `identities.json` | UserIdentity attestation stubs (M9 §8.6) |
| `terms.json` / `attributions.json` | Evidence registries (`{ version, items }`) |

Sections are not a separate seed file: on seed and revision save, heading blocks
with ids become Prisma `Section` rows (`section_id` = `sec_{artifactId}__{stableKey}`).

## Startup (`pnpm run dev` → API)

1. Create `prisma/dev.db` if missing.
2. `prisma db push`.
3. If no `SeedMeta` ⇒ load `prisma/seed/` JSON and write `SeedMeta`.
4. Hono serves `/api/*` (`server/index.ts`, port **8787**).

## Common ops

```bash
pnpm run dev
pnpm db:push
pnpm db:seed
pnpm db:seed -- --force          # wipe + reseed
rm -f prisma/dev.db prisma/dev.db-journal && pnpm run dev
```

## Adding a seed file

1. Add/edit JSON under `prisma/seed/` and wire it in `prisma/seed.ts`.
2. Reset runtime (`pnpm db:seed -- --force` or delete `dev.db`) so SeedMeta clears.
3. Empty re-seed is intentional for this local prototype.

## API surface (high level)

- Corpus: `/api/areas`, `/api/collections`, `/api/dossiers`, `/api/artifacts`
- Threads/RFC: `/api/threads`, promote / revsets / decide, soft-delete posts
- Claims / adjudication / metrics via Collection dashboard
- Findings / candidates / Accepted Risk
- Search, identities, board-hide, audit-logs (`actor_id` required for audit)
- Health: `GET /api/health`

Documents dual-emit `artifact_id` + legacy `page_id`. Prefer `/api/artifacts`.
