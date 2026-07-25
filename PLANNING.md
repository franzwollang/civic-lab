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
| Seed format | **JSON** under seed dir (e.g. `prisma/seed/`) |
| Dev startup | Create DB if missing → `db push` → **re-seed if empty** (`SeedMeta`) |
| Schema growth | Existing editor entities first; CONCEPT tables as milestones need them |
| Package manager | **pnpm@9.15.9** (`packageManager` field; lockfile v9) |
| onlyBuiltDependencies | In **`package.json` → `pnpm.onlyBuiltDependencies`** (never JSON-string arrays in `.npmrc`) |
| Fumadocs | **Pinned 16.5.4** — caret bumps to 16.12+ break Vite (`-inset-s-4` unknown to Tailwind 4.1.12) |
| API server | **Hono** on Node (`@hono/node-server`); Prisma server-side only (`server/`) |
| `/docs` | Engineering only |
| Prototype identity | Seed users + **impersonation** |
| Adjudicators / Red Team | **Global** |

### Domain (aligned with CONCEPT)

| Topic | Decision |
|---|---|
| Hierarchy | **Area → Collection → Dossier → Artifact → Revision/Section** |
| Collections | Canon singleton; one Manual Collection per country; shared splash chrome; Manuals map picker |
| Dossier UX | Subforum; threads primary |
| Artifact | Revisioned document; Manual **immutable lane**; Canon no lane |
| Page | UI view only — not a domain type |
| Threads | Home dossier + multi-target join; home may ≠ targets; discussion may cross Collections |
| RFC merge | **Only 1:1 leaf RFC↔artifact** merges; multi ⇒ wrapper + subs |
| Wrapper scope | All children in the **same Collection** |
| Wrapper decided | When **all children** decided |
| `decided` outcomes | `merged \| rejected \| parked` |
| Merge authority | Follows **artifact Collection**: Manual → stewards; Canon routine → **editors**; Canon restricted / Critical-AR / `owner_merge_only` → **owner** (owner may revert) |
| Accepted Risk | On **leaf** RFC; Critical open Finding blocks merge unless present |
| Claims | Profiles **`empirical` \| `requirement`**; legality by Area/lane |
| Regional Canon | `region_code` (curated) and/or `region_label`; anti-smuggle hard rule |
| Baselines / anti-gaming | Default baseline 0.5 or family base rate; n≥20 boards; advisory only |
| Charter | Living Canon artifact `owner_merge_only`; min premises in CONCEPT §9.3 |
| Audit | Append-only for merges, adjudications, AR, roles; soft-delete posts |
| Dossier taxonomy | No templates; organic + tags |
| Site copy | Prefer artifacts when feasible; legal boilerplate may stay static |
| External artifacts | App D `external_artifact` node + provider whitelist landed; attribution `immutable_ref` for registry snapshots |
| Collection dashboard | Shared chrome; scoped panels (CONCEPT §11) |
| Model claim graph | Deferred |

### Claim profile summary

| Profile | Legal on | Scores forecasts? |
|---|---|---|
| `empirical` | Manual Descriptive; Canon (`scope`) | Yes |
| `requirement` | Manual Alignment | Quality only |

Canon anti-smuggle: prefer global; regional multi-country/domain OK; single-state institutions/actors → Manual; borderline → adjudicator flag.

---

## Current state

| Layer | Reality |
|---|---|
| Product UI | Hybrid — Area/Collection/Dossier routes data-driven; many dossier panels still fixture |
| Editor + doc pipeline | Real (Plate, evidence, revisions); plain `src/api/actions` save |
| Persistence | **SQLite via Prisma** (`prisma/dev.db`; seeds in `prisma/seed/`) |
| Auth | Seed users + **header impersonation** (M8) + **identity attestation hooks** (M9 §8.6); full OAuth/IdP deferred |
| Toolchain | **pnpm 9.15.9** (`packageManager`); `pnpm build` + `pnpm test:smoke` green (35/35) |

**Next build:** Milestone roadmap **M0–M9 complete** for prototype scope. Remaining open work is residual (editor blockquotes/tables/images, moderator tools, Fumadocs unpin, content migration). Home RFC/RT panels + attribution/`immutable_ref`/`external_artifact` landed. Full OAuth/IdP is explicitly deferred past impersonation + identity hooks.

---

## Status board

| Milestone | Status | Exit criteria |
|---|---|---|
| **M0 — Orientation** | `done` | CONCEPT/PLANNING coherent; residual gaps defaulted |
| **M1 — Persistence** | `done` | Prisma/SQLite; seeds; db push; seed-if-empty; Hono API via Prisma |
| **M2 — Editor solidity** | `done` | Void nav ✓; clipboard ✓; a11y ✓; full preview ✓; server validate ✓ |
| **M3 — Content bridge** | `done` | Shared reader ✓; Artifact naming + `@@map` ✓; Section extractor ✓; dual-emit `artifact_id` ✓; product `/edit` Plate chrome ✓ (Section DB sync → M5) |
| **M4 — Corpus IA** | `done` | Area/Collection/Dossier ✓; routes ✓; home trending ✓; Manuals map+list ✓; §11 dashboard chrome ✓; US+CA/GB/DE Manual seeds ✓ (3D globe deferred) |
| **M5 — Threads + RFC** | `done` | Thread/Post/Target ✓; Section DB sync ✓; leaf + wrapper RFC promote + RevSet→proposal revision ✓; leaf Merge/Reject/Park + parent decided cascade ✓; reply composer ✓; Collection merge authority (§3.4) ✓ |
| **M6 — Claims + lanes** | `done` | Claim table + profile legality ✓; immutable Manual lanes ✓; adjudication scaffolding ✓; claim authoring UX ✓; Collection quality/forecast metrics ✓ |
| **M7 — Red Team** | `done` | Finding + FindingTarget ✓; dashboard Critical/recent counts ✓; Accepted Risk on leaf + Critical merge gate ✓; Candidate→Finding + timeline filters/sidebar ✓ |
| **M8 — Discovery** | `done` | First-cut search API + header ✓; breadcrumbs + up-nav ✓; impersonation role UX ✓ |
| **M9 — Policy** | `done` | Charter living `owner_merge_only` artifact ✓; reputation advisory board ✓; Owner board-hide + audit ✓; real-identity policy hooks (§8.6) ✓ (full OAuth deferred) |

---

## Sequencing

1. Persistence before forum depth  
2. Grow schema with features  
3. Seeds disposable  
4. Don’t strand editor  
5. Sections before precise anchors  
6. Claims before scoring theater  
7. Impersonation before real auth  

---

## Still open

None blocking architecture. Remaining work is **implementation** (`OPEN_ISSUES.md`) and **content** (Charter prose, seed dossiers). Model→forecast implication graph deferred until claim UX exists.
---

## Coordination

- CONCEPT is the product/reference spec; this file is sequencing + engineering decisions.
- When a milestone exits, mark `done` and clear related `OPEN_ISSUES.md` the same turn.
- Next: residual open work — evidence registries / `immutable_ref`, image upload, blockquotes (optional), moderator tools, or Fumadocs unpin (see `OPEN_ISSUES.md`).
