# Planning

Roadmap and coordination for the Civic Lab prototype. Concrete open work lives in
`OPEN_ISSUES.md`. Product vocabulary/reference lives in `CONCEPT.md`. Session focus
lives in `SCRATCHPAD.json`.

---

## Decisions (durable)

### Stack / ops

| Decision | Choice |
|---|---|
| Runtime DB | **SQLite** via **Prisma** |
| Schema sync (prototype) | **`prisma db push`** |
| Seed format | **JSON** under `prisma/seed/` |
| Dev startup | Create DB if missing → `db push` → **re-seed if empty** (`SeedMeta`) |
| Schema growth | Grow tables with features; seeds disposable |
| Package manager | **pnpm@9.15.9** (`packageManager`; lockfile v9) |
| onlyBuiltDependencies | In **`package.json` → `pnpm.onlyBuiltDependencies`** (never JSON arrays in `.npmrc`) |
| Fumadocs | **`fumadocs-ui`/`core` 16.14.0** + Tailwind **4.3.3** (`-inset-s-4`); `fumadocs-mdx` 14.2.7 (Vite 6) |
| Build output | **`dist/` gitignored** — regenerate via `pnpm build`; not committed |
| API server | **Hono** + `@hono/node-server`; Prisma server-side only (`server/`) |
| `/docs` | Engineering only |
| Prototype identity | Seed users + **header impersonation** + identity attestation hooks |
| Adjudicators / Red Team | **Global** |
| Verify green | `pnpm build` + `pnpm test:smoke` (include HTTP smokes for route gates) |

### Domain (aligned with CONCEPT)

| Topic | Decision |
|---|---|
| Hierarchy | **Area → Collection → Dossier → Artifact → Revision/Section** |
| Collections | Canon singleton; one Manual Collection per country; shared splash; Manuals map |
| Dossier UX | Subforum; threads primary |
| Artifact | Revisioned document; Manual **immutable lane**; Canon no lane |
| Page | UI view only — not a domain type |
| Threads | Home dossier + multi-target join; no public `POST /api/threads` (seed/promote) |
| RFC merge | **Only 1:1 leaf RFC↔artifact**; multi ⇒ wrapper + subs |
| Wrapper scope | All children in the **same Collection** |
| Wrapper decided | When **all children** decided |
| `decided` outcomes | `merged \| rejected \| parked` |
| Merge authority | Manual → stewards; Canon routine → editors; restricted/Critical-AR/`owner_merge_only` → owner |
| Accepted Risk | On **leaf** RFC; Critical open Finding blocks merge unless AR present |
| Claims | Profiles **`empirical` \| `requirement`**; legality by Area/lane |
| Regional Canon | `region_code` / `region_label`; anti-smuggle hard rule |
| Baselines / anti-gaming | Baseline 0.5 or family rate; n≥20 boards; Owner board-hide |
| Charter | Living Canon artifact `owner_merge_only` |
| Audit | Append-only; soft-delete posts; audit list steward/Owner-gated |
| External artifacts | App D node + provider whitelist; attribution `immutable_ref` |
| Collection dashboard | Shared chrome; live §11 panels on Collection splash |
| Model claim graph | Deferred |

### Claim profile summary

| Profile | Legal on | Scores forecasts? |
|---|---|---|
| `empirical` | Manual Descriptive; Canon (`scope`) | Yes |
| `requirement` | Manual Alignment | Quality only |

---

## Current state

| Layer | Reality |
|---|---|
| Product UI | Data-driven corpus; Collection splash = live dashboard; fixture dossier dashboard redirected |
| Editor | Plate lists/links/blockquotes/evidence/external_artifact/tables/images (upload) |
| Persistence | SQLite + Prisma; rich M4–M9 seeds |
| Auth | Impersonation + identity hooks; body `actor_id` until IdP |
| Toolchain | pnpm 9; Hono `:8787`; smokes include HTTP gates |
| Server layout | Route registrars under `server/routes/*`; `index.ts` ~64 lines |

**Phase:** **Post-R0 optional / deferred** after M0–M9 + residual polish.
R0 marathon (About/FAQ → CONCEPT rewrite) landed.

---

## Status board

| Milestone | Status | Exit criteria |
|---|---|---|
| **M0 — Orientation** | `done` | CONCEPT/PLANNING coherent |
| **M1 — Persistence** | `done` | Prisma/SQLite; Hono API |
| **M2 — Editor solidity** | `done` | Void nav/clipboard/a11y/preview/validate |
| **M3 — Content bridge** | `done` | Reader; Artifact `@@map`; dual-emit; product edit |
| **M4 — Corpus IA** | `done` | Area/Collection/Dossier; Manuals map; §11 chrome |
| **M5 — Threads + RFC** | `done` | Thread/RFC/RevSet/decide/authority |
| **M6 — Claims + lanes** | `done` | Legality; lanes; adjudication; authoring; metrics |
| **M7 — Red Team** | `done` | Findings; AR + Critical gate; Candidate→Finding |
| **M8 — Discovery** | `done` | Search; breadcrumbs; impersonation chrome |
| **M9 — Policy** | `done` | Charter; reputation; board-hide; identity hooks |
| **R0 — Residual polish** | `done` | About/FAQ artifacts; fixtures; typed posts; tables; home exemplars; CONCEPT rewrite |

---

## Residual phase sequencing (cloud marathon)

Optimize for **observable slices** with smokes. Prefer this order:

1. ~~**About → artifact**~~ (**done** — `canon-about`, `/about` redirect, `smoke-about`)
2. ~~**FAQ → artifact**~~ (**done** — `canon-faq`, `/faq` redirect, `smoke-faq`)
3. ~~**Fixture retirement**~~ (**done** — demo pages deleted; legacy redirects; `smoke-fixture-retirement`)
4. ~~**Typed finding/mitigation posts**~~ (**done** — RT gate; composer; filters; `smoke-typed-posts`)
5. ~~**Plate tables**~~ (**done** — `@platejs/table@52`; reader/export; `smoke-editor-tables`)
6. ~~**Home CONCEPT links**~~ (**done** — `#what-is-this` + live exemplars; `smoke-home-preamble`)
7. ~~**CONCEPT.md rewrite**~~ (**done** — hierarchy/claims/lanes/RFC/evidence; `smoke-concept`)
8. ~~**Image upload pipeline**~~ (**done** — `/api/uploads/images`; editor insert; formats beyond webp; `smoke-image-upload`)
9. ~~**`dist/` gitignore**~~ (**done** — stop tracking Vite build output; `smoke-dist-gitignore`)
10. ~~**Fumadocs unpin**~~ (**done** — Tailwind 4.3.3 + fumadocs-ui/core 16.14.0; `smoke-fumadocs`)
11. ~~**Canon revert audit**~~ (**done** — Owner `POST …/revert`; `smoke-canon-revert`)
12. ~~**Role-change audit**~~ (**done** — Owner `POST /api/users/:id/roles`;
    overrides + effective users; `smoke-role-change`)
13. ~~**Mod queue UI**~~ (**done** — `/mod` deleted posts / findings /
    adjudication; `smoke-mod-queue`)
14. ~~**Server split (first slice)**~~ (**done** — `server/db/*` leaf modules +
    health/uploads/corpus/moderation routes; `smoke-server-split`)
15. ~~**Server split (threads/claims/findings routes)**~~ (**done** —
    `server/routes/{threads,claims,findings}.ts`)
16. ~~**Server split (artifacts routes)**~~ (**done** —
    `server/routes/artifacts.ts`; index ~64 lines; `smoke-server-split`)
17. **Optional / deferred next:** OAuth/IdP, `server/db.ts` domain module
    extraction, Manuals 3D globe, model→forecast graph

**Agent rules of thumb**

- One OPEN_ISSUES item with AC per cron turn when possible  
- Merge tip-of-stack PRs; don’t reopen M0–M9 exit criteria  
- New routes ⇒ extend `smoke-http-gates` or add HTTP assertions  
- Cron branches that start at `main`: merge latest progression tip first  
- Never weaken smokes to pass; never force-push

---

## Still open

R0 marathon + image upload + `dist/` gitignore + Fumadocs unpin + Canon revert +
role-change audit + mod queue UI + server split (routes through artifacts) done —
see remaining `OPEN_ISSUES.md` **Optional / deferred**. No architecture blockers.
Known debt: `server/db.ts` domain modules, client→server import of
prototype-users (header still seed roles until IdP), tsc not covering `server/`
(Vite/smoke are the gates today).

---

## Coordination

- CONCEPT = product reference; PLANNING = sequencing; OPEN_ISSUES = actionable AC;
  SCRATCHPAD = session snapshot.
- When an issue lands: resolve in OPEN_ISSUES + log line + advance SCRATCHPAD `next_step`.
- Next: **OAuth / IdP**, or `server/db.ts` domain module extraction / Manuals 3D globe.
