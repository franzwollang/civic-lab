# Open Issues

Current open work only (no history). Resolutions → `OPEN_ISSUES_LOG.jsonl`.
Roadmap/sequencing → `PLANNING.md`. Product reference → `CONCEPT.md`.

---

## A. Editor correctness (working surface: `/test/editor`)

- [ ] **Editor MVP gaps called out by codebase**
  - `MathDecoratePlugin` (`src/editor/math-plugin.ts`) unused — register or delete.
  - `validateDocumentForMerge` unused — wire into save/merge path or remove.
  - Lists / blockquotes / tables / links not in Plate plugin set — decide MVP vs defer.
  - Images require `.webp` only; no upload pipeline.
  - Term dialog always saves `scope: { kind: "global" }` despite dossier/country scopes in schema.
  - Attribution `immutable_ref` unused vs `CONCEPT.md` Appendix D.

---

## C. Product shell vs real data (M4 done — residual)

- [ ] **Add CONCEPT tables + seeds incrementally**
  - Done: Area / Collection / Dossier (+ `Artifact.dossier_id`); Manual seeds for US/CA/GB/DE.
  - Next: Finding/AcceptedRisk as later milestones need them. Claim table landed in M6.
  - Hardcoded US-voting JSX still present on some panels (home RFC/Red Team, thread pages) — retire as M5/M7 tables arrive.

- [ ] **Make product routes data-driven**
  - Done: `/canon`, `/manuals`, `/collection/:id`, `/dossier/:id` load Prisma records; header/home CTAs point at Area entry routes.
  - Done: home **Trending Dossiers** from `/api/dossiers` (artifact_count + collection join).
  - Done: Collection splash loads **`/api/collections/:id/dashboard`** (CONCEPT §11 chrome; claim quality/forecast + Critical/Red Team counts live).
  - Remaining: dossier tabs show live threads (M5 first cut); home RFC/Red Team panels still fixture until RFC/Findings tables mature.

- [ ] **Unify artifact body with revisioned editor documents**
  - Product `/artifact/:id` loads live `ArtifactRevision` via DocumentReader; related-artifacts sidebar from dossier API.
  - Prisma models renamed `Artifact` / `ArtifactRevision` with `@@map`; wire dual-emits `artifact_id` + legacy `page_id`.
  - Product chrome **Edit** → `/dossier/:dossierId/artifact/:artifactId/edit` (Plate + SidebarNav); `/test/editor` retained for isolated work.
  - Done: US (`us-voting-1`) + CA/GB/DE Manual dossier stub artifacts seeded with Plate `content_json`.

- [ ] **Migrate site copy into artifacts (incremental)**
  - Done: Constitution/Charter → living `canon-charter` artifact (`/constitution` redirects).
  - Remaining: About, FAQ, home explainer → artifact-backed when feasible.
  - Leave licensing/legal boilerplate code-static if needed.

- [ ] **CONCEPT.md rewrite pass (drift + gaps)**
  - Area/Collection hierarchy; kill Requirements Matrix §9; claims as adaptable abstraction; Canon claim scope; bridge soft-label; parent/sub-RFC; evidence/terms/attributions section; fix dupes/numbering.

---

## D. Thread-first + RFC (CONCEPT §§3)

- [ ] **Thread + posts + flexible anchors**
  - Done: Prisma `Thread` / `ThreadPost` / `ThreadTarget`; seed (`prisma/seed/threads.json`); API `GET /api/threads`, `GET /api/threads/:id`, `GET /api/dossiers/:id/threads`, `POST …/posts`; dossier Threads/RFCs tabs list store data; Collection dashboard open-thread counts live; section targets via persisted `Section` rows; **reply composer** on thread + RFC pages with seed-user impersonation (`src/app/lib/prototype-users.ts`, `ReplyComposer`).
  - Remaining: typed posts (finding/mitigation) later.
  - Global header acting-user switcher + role affordances: done (M8).
  - States seeded: `open` | `rfc` (also model `review` | `decided` | `archived`).

- [ ] **RFC promotion + parent/sub-RFC + RevSets**
  - Done (leaf + wrapper + decide + §3.4 authority + §7.6 Critical gate): Prisma `RevSet`; seed `revsets.json` + proposal revision on `thread-us-voter-reg-rfc`; seed multi-artifact open `thread-us-multi-open`; `POST /api/threads/:id/promote` (1:1 leaf **or** same-Collection wrapper + sub-RFCs; cross-Collection → `cross_collection`); `GET|POST /api/threads/:id/revsets` (leaf only; proposals do not flip `current_revision_id` until merge); `POST /api/threads/:id/decide` (`merged`|`rejected`|`parked`) on leaves — merge applies latest RevSet → `current_revision_id` + Section sync; wrappers reject direct decide (`wrapper_not_direct`); parent cascades to `decided` when all children decided (mixed outcomes → `parked`); **Collection merge authority** (CONCEPT §3.4): Manual → steward (+ Owner), Canon routine → editor (+ Owner), Canon `owner_merge_only` / Critical-AR path → Owner; `forbidden` 403; `critical_unaccepted` 409 without Accepted Risk; `merge_authority` on leaf `GET /api/threads/:id`; seed `canon-charter` + `user-eve` owner; smokes `smoke-merge-authority.ts` + `smoke-revsets.ts` + `smoke-accepted-risk.ts`.
  - Remaining: typed Finding/Mitigation posts + Findings timeline UX (M7 residual).
  - RevSet → `ArtifactRevision` (propose ✓; merge apply ✓).

---

## E. Scorable claims + lanes (CONCEPT §§4–6)

- Claim table, legality, immutable Manual lanes, adjudication, authoring UX, and Collection quality/forecast metrics panels are landed (M6).
- Remaining later: Model→forecast implication graph (deferred).

---

## F. Red Team + oversight (CONCEPT §§7–8)

- Findings, Candidate→Finding promotion, timeline filters, Accepted Risk, and Critical merge gate are landed (M7).
- Role separation via impersonation (global header switcher + role affordances) landed (M8).

---

## G. Evidence / external refs (editor-adjacent → CONCEPT Apps C–D)

- [ ] **Wire evidence registries beyond `/test/editor`**
  - Artifact readers resolve citation/term chips against attributions/terms APIs.
  - Seed richer attributions/terms than the single-item registries.

- [ ] **External artifact references (whitelist + immutability)**
  - `external_artifact` / provider allowlist per CONCEPT Appendix D.
  - Require general_id + specific_id; validate GitHub SHA / DOI version / arXiv vN patterns.
  - Surfaced in editor + validation.

---

## H. Product UX / onboarding

- [ ] **Home / About alignment with CONCEPT**
  - Home already has a preamble; ensure Canon vs Manuals, thread-first, scorable claims, Red Team, adjudicators are explicit with links to 1–2 live exemplars (once data-driven).
  - Avoid duplicating FAQ; deep links fine.

- [ ] **Replace remaining placeholder panels**
  - Dossier tab stubs, disabled Nominate-for-RFC where still stubbed, etc.
  - Thread/RFC reply composer: done (impersonated author).
  - Breadcrumbs + up-nav: done (Area→Collection→Dossier→leaf on corpus surfaces).
  - Global header impersonation switcher + role affordances: done (M8).

---

## I. Later / policy-heavy (M9 done — residuals track)

- [ ] **Manuals 3D globe picker** — SVG map+list satisfies CONCEPT map+list; optional 3D polish deferred.
- [ ] **Requirements Matrix artifact type** (CONCEPT §9) — **superseded**: use Claims + citations instead (see §E).
- Reputation layer (CONCEPT §9.2): **done** (M9 first cut) — Collection dashboard advisory board from merged RevSets / review labor / RT findings / adjudications / AR signs; n≥20 anti-gaming floor; `smoke-reputation`.
- Charter as living gated artifact: **done** (M9 first cut) — `canon-governance-1` + `canon-charter` (`owner_merge_only`); `/constitution` → artifact; Owner edit gate; `smoke-charter`.
- Anti-gaming / scoring leaderboard policy: **done** (M9) — forecast + reputation boards gate n≥20; Owner board-hide + lift + append-only `AuditLog` (`smoke-board-hide`).
- Auth + real-identity policy hooks: **done** (M9) — `UserIdentity` + Owner attest / self-request; Manual steward country / long-term-ties gate on decide + AR; header badges; `smoke-identity-policy`. Full OAuth/IdP deferred.
- [ ] **Moderator tools + audit logs** — board-hide + identity attest audit landed; broader mod tools still open.
- [ ] **External artifact whitelist** (CONCEPT App D) — deferred until evidence/editor bridge solid.

---

## J. Toolchain / packaging (keep green)

- [ ] **Fumadocs upgrade path**
  - Pinned `fumadocs-{core,ui}@16.5.4` + `fumadocs-mdx@14.2.7` after 16.12.x broke Vite (`Cannot apply unknown utility class -inset-s-4`).
  - Before unpinning: confirm Tailwind (or Fumadocs preset) provides `inset-s-*`, or switch to prebuilt `fumadocs-ui/style.css`.

---

## Notes (do not treat as separate issues)

- Spec-compliance page/route appears **already removed** from `routes.tsx` / header — not listed above.
- Three parallel content systems today: Fumadocs `/docs`, static About/FAQ/Constitution, JSON page editor — unify deliberately, don’t accidentally fork a fourth.
- Thread-first principle: no per-page micro comment sections; attach threads to targets.
- Lane hygiene and separation of powers (stewards merge; Red Team findings; adjudicators resolve claims) are load-bearing CONCEPT constraints.
- Toolchain check: `pnpm install` (needs pnpm 9) → `pnpm build` → `pnpm test:smoke` (32 scripts). API: Hono on `:8787`. Smoke fixtures under `prisma/smoke-*.db` are disposable.
