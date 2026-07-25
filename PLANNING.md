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
| External artifacts | Defer App D enforcement until evidence bridge solid |
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
| Product UI | Static high-fidelity mock |
| Editor + doc pipeline | Real (Plate, evidence, revisions) |
| Persistence | **SQLite via Prisma** (`prisma/dev.db`; seeds in `prisma/seed/`) |
| Auth | None (impersonation planned) |

**Next build:** M4 Corpus IA (Area/Collection/Dossier; data-driven routes).

---

## Status board

| Milestone | Status | Exit criteria |
|---|---|---|
| **M0 — Orientation** | `done` | CONCEPT/PLANNING coherent; residual gaps defaulted |
| **M1 — Persistence** | `done` | Prisma/SQLite; seeds; db push; seed-if-empty; Express via Prisma |
| **M2 — Editor solidity** | `done` | Void nav ✓; clipboard ✓; a11y ✓; full preview ✓; server validate ✓ |
| **M3 — Content bridge** | `done` | Shared reader ✓; Artifact naming + `@@map` ✓; Section extractor ✓; dual-emit `artifact_id` ✓; product `/edit` Plate chrome ✓ (Section DB sync → M5) |
| **M4 — Corpus IA** | `not started` | Area/Collection/Dossier; shared splash; map picker; data-driven routes |
| **M5 — Threads + RFC** | `not started` | Posts, targets, leaf/wrapper RFC, RevSet→revision, authority rules |
| **M6 — Claims + lanes** | `not started` | Claim table + profiles; lane immutability; adjudication scaffolding |
| **M7 — Red Team** | `not started` | Findings; Accepted Risk on leaf; Critical merge gate |
| **M8 — Discovery** | `not started` | Search; breadcrumbs; impersonation role UX |
| **M9 — Policy** | `not started` | Real auth; reputation; Charter artifact; anti-gaming |

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
- Next: **M4** Corpus IA (or §A Editor MVP gaps polish in parallel).
