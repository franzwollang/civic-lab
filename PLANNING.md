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
| Fumadocs | **16.14.0** (`fumadocs-ui`/`core`; `fumadocs-mdx` **14.2.7** for Vite 6); Tailwind **4.3.3** |
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
| Auth | IdP-lite cookie session + optional OIDC with JWKS id_token verify |
| Toolchain | pnpm 9; Hono `:8787`; smokes include HTTP gates |

**Phase:** **Post-R0 optional / deferred** after M0–M9 + residual polish.
R0 marathon (About/FAQ → CONCEPT rewrite) landed. Canon revert + role-change +
mod queue UI + model→forecast implication MVP + DAG UI + **advisory score
propagation** landed.

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
10. ~~**Fumadocs unpin**~~ (**done** — Tailwind 4.3.3; fumadocs 16.14.0; `smoke-fumadocs`)
11. ~~**Server split (leaf + registrars)**~~ (**done** — `server/db/*` leaves +
    `server/routes/{health,uploads,corpus,moderation}`; `smoke-server-split`)
12. ~~**Domain route registrars**~~ (**done** — `artifacts` / `threads` /
    `claims` / `findings`; slim `index.ts`; suite **50/50**)
13. ~~**Domain db modules**~~ (**done** — `artifactsDb` / `threadsDb` /
    `claimsDb` / `findingsDb` / `corpusDb`; `createAcceptedRisk` in barrel;
    suite **50/50**)
14. ~~**OAuth / IdP-lite session→actor**~~ (**done** — cookie login;
    `requireSessionActor`; body `actor_id` no longer authorizes;
    `smoke-session-actor`; suite **51/51**)
15. ~~**Canon revert audit**~~ (**done** — Owner/Canon-only; parent tip restore;
    append-only `revert` audit; session-bound route; `smoke-canon-revert`;
    suite **52/52**)
16. ~~**Role-change audit**~~ (**done** — `UserRoleAssignment`; effective users;
    session `POST /api/users/:id/roles`; Collection appoint UI;
    `smoke-role-change`; suite **53/53**)
17. ~~**Mod queue UI**~~ (**done** — `/mod` soft-deletes + open findings +
    adjudication; steward Canon filter; `smoke-mod-queue`; suite **54/54**)
18. ~~**Model→forecast implication links MVP**~~ (**done** — `implies_forecast`
    links; seed `claim-canon-enp-model`; composer + list; `smoke-claim-implications`;
    suite **55/55**)
19. ~~**Model→forecast implication DAG UI**~~ (**done** — `buildImplicationGraph`;
    `ClaimImplicationGraph` on ArtifactClaimsPanel; `smoke-claim-implication-graph`;
    suite **56/56**)
20. ~~**Model→forecast implication score propagation**~~ (**done** —
    `scoreModelImplications`; advisory Brier/log/skill on models from resolved
    implied forecasts; DAG summary + per-edge contrib;
    `smoke-claim-implication-scores`; suite **57/57**)
21. ~~**External OIDC provider swap-in**~~ (**done** — reapplied from b1c5;
    `GET /api/auth/oidc/status|start|callback`; `OIDC_MOCK` + subject map;
    `smoke-oidc`; suite **58/58**)
22. ~~**OIDC JWKS id_token verify**~~ (**done** — reapplied from `0004`;
    jose JWKS + iss/aud/exp/nonce; `OIDC_JWKS_URI`/discovery; `smoke-oidc`)
23. ~~**OIDC JWKS**~~ done — see item 22.
24. **Stop (default):** remaining Optional items are product-gated — do **not**
    invent AC for reputation rollup or ship a 3D globe while SVG satisfies
    CONCEPT §1.2. Resume only after explicit product direction.

**Agent rules of thumb**

- One OPEN_ISSUES item with AC per cron turn when possible  
- Merge tip-of-stack PRs; don’t reopen M0–M9 exit criteria  
- New routes ⇒ extend `smoke-http-gates` or add HTTP assertions  
- Cron branches that start at `main`: merge latest progression tip first  
- Never weaken smokes to pass; never force-push  
- When only product-gated Optionals remain: **stop** (docs handoff OK)

---

## Still open

All actionable marathon / optional engineering slices through OIDC JWKS are
**done**. Remaining `OPEN_ISSUES.md` Optionals (Manuals 3D globe; reputation
implication rollup) need product decisions — not agent invention. Known debt:
client→server import of prototype-users, tsc not covering `server/` (Vite/smoke
are the gates today).

---

## Coordination

- CONCEPT = product reference; PLANNING = sequencing; OPEN_ISSUES = actionable AC;
  SCRATCHPAD = session snapshot.
- When an issue lands: resolve in OPEN_ISSUES + log line + advance SCRATCHPAD `next_step`.
- Next: **stop** until product unblocks Manuals globe or reputation-board
  implication rollup design. Fresh crons: merge furthest tip
  (`cursor/next-task-progression-4e64` / prior `24fc`), confirm stop, exit.
