# Open Issues

Current open work only (no history). Resolutions → `OPEN_ISSUES_LOG.jsonl`.
Roadmap/sequencing → `PLANNING.md`. Product reference → `CONCEPT.md`.

---

## A. Editor correctness (working surface: `/test/editor`)

- [ ] **Copy/paste + plain-text export for void embeds**
  - **Context**: Payload lives on element props (`latex`/`code`), so native copy does not round-trip.
  - **Acceptance**:
    - Copy produces reasonable text (`$…$`, `$$…$$`, fenced blocks) for plain destinations.
    - Paste of those forms recreates the correct node type where appropriate.
    - Canonical Markdown-ish export defined for revision previews/diffs.
  - **Note**: Mermaid/data fenced paste exists partially in `test-editor.tsx`; generalize.

- [ ] **Accessibility for rendered embeds**
  - **Acceptance**:
    - Render containers have meaningful `aria-label` / `aria-describedby`.
    - Keyboard users can focus/select/remove embeds without a mouse.
    - Generated HTML (e.g. procedure/pseudocode Prism output) sanitized before DOM insert (mermaid already uses DOMPurify; procedure path does not).

- [ ] **Read preview renders full document model**
  - **Context**: `src/app/pages/test-preview.tsx` only renders basic headings/paragraphs; saved revisions already contain math/mermaid/evidence/etc.
  - **Acceptance**: Preview (and any future artifact reader) renders the same node set as the editor (at least math, mermaid, procedure, data, image, evidence, citation, term).

- [ ] **Server-side revision validation on save**
  - **Context**: Client validates via `src/doc/validation.ts`; `POST /api/pages/:pageId/revisions` accepts arbitrary JSON (`server/index.ts`).
  - **Acceptance**: Server rejects invalid revisions (schema + at least structural validation); optionally reuse/port `validateDocument` / Zod revision schema.

- [ ] **Editor MVP gaps called out by codebase**
  - `MathDecoratePlugin` (`src/editor/math-plugin.ts`) unused — register or delete.
  - `validateDocumentForMerge` unused — wire into save/merge path or remove.
  - Lists / blockquotes / tables / links not in Plate plugin set — decide MVP vs defer.
  - Images require `.webp` only; no upload pipeline.
  - Term dialog always saves `scope: { kind: "global" }` despite dossier/country scopes in schema.
  - Attribution `immutable_ref` unused vs `CONCEPT.md` Appendix D.

---

## C. Product shell vs real data (after M1)

- [ ] **Add CONCEPT tables + seeds incrementally**
  - Order roughly: Area/Collection/Dossier → Artifact meta (+ rename from Page) → Section → Thread/Post/Target → Claim → Finding/AcceptedRisk.
  - Hardcoded US-voting JSX → seeds or discard.

- [ ] **Make product routes data-driven**
  - Route params select Prisma records; dossier tabs real lists; home from same store.

- [ ] **Unify artifact body with revisioned editor documents**
  - Artifact pages load current ArtifactRevision `content_json` via shared reader.
  - Edit via Plate save pipeline.

- [ ] **Top-level IA: Area → Collection → Dossier**
  - Canon Area + singleton Collection; Manuals Area + per-country Collections.
  - Shared Collection splash/dashboard; Manuals picker = 3D map + list/search.
  - Dossier = subforum-like UX.
  - Taxonomy: Area, Collection, Dossier, Artifact (typed), Section, Thread, RFC (+ sub-RFC), RevSet, Claim, Finding, Accepted Risk, lanes, bridge (soft).

- [ ] **Migrate site copy into artifacts (incremental)**
  - About, FAQ, Constitution/Charter, home explainer → artifact-backed when feasible.
  - Leave licensing/legal boilerplate code-static if needed.

- [ ] **CONCEPT.md rewrite pass (drift + gaps)**
  - Area/Collection hierarchy; kill Requirements Matrix §9; claims as adaptable abstraction; Canon claim scope; bridge soft-label; parent/sub-RFC; evidence/terms/attributions section; fix dupes/numbering.

---

## D. Thread-first + RFC (CONCEPT §§3)

- [ ] **Thread + posts + flexible anchors**
  - `ThreadPost` timeline (typed posts later: comment / finding / mitigation).
  - Default target: dossier-wide. Also artifact + **section** targets.
  - `ThreadTarget` join across anchorable tables (dossier, artifact, section, …).
  - States: `open` | `rfc` | `review` | `decided` | `archived`.
  - Reply composer (local/impersonated author OK).

- [ ] **Section entities for anchoring**
  - Stable Section rows synced from artifact structure (e.g. heading blocks with stable ids).
  - Threads can target section without brittle text offsets.

- [ ] **RFC promotion + parent/sub-RFC + RevSets**
  - 1:1 leaf merges only; multi ⇒ same-Collection wrapper + subs.
  - Parent `decided` when all children decided; outcomes merged|rejected|parked.
  - Merge authority follows artifact Collection; Accepted Risk on leaf.
  - RevSet → `ArtifactRevision`.

---

## E. Scorable claims + lanes (CONCEPT §§4–6)

- [ ] **Claim table + profile legality**
  - Profiles `empirical` | `requirement`; legal only on matching Area/lane (CONCEPT §5).
  - Empirical types fact|forecast|model; Canon `scope` + anti-smuggle.
  - Requirement claims must cite Canon; quality metrics only.
  - UX for authoring (vs editor embeds) designed in M6; model implication graph deferred.

- [ ] **Immutable lanes on Manual artifacts**
  - Required at create; API/DB reject changes; Canon has no Manual lane.
  - Cross-lane = links + computed composite label.

- [ ] **Claim resolution + adjudication scaffolding**
  - Global adjudicators; empirical vs requirement status sets; request-adjudication queue.

- [ ] **Metrics + Collection dashboard panels**
  - Quality vs forecast accuracy; Collection-scoped chrome (CONCEPT §11).

---

## F. Red Team + oversight (CONCEPT §§7–8)

- [ ] **Findings (thread-required context)**
  - Finding always linked to originating thread; also targets artifact/claim/etc.
  - Severity, likelihood, status, evidence links.
  - Candidate → Finding promotion (can start stubbed).

- [ ] **Accepted Risk + merge gating**
  - Attaches to **merging** (1:1) RFC; signer = impersonated user.
  - Gate: no merge with open Critical finding unless Accepted Risk exists.

- [ ] **Role separation via impersonation**
  - Seed users/roles; switch acting identity on the fly for testing.
  - Distinct affordances per role; do not collapse into one admin.

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

- [ ] **Search**
  - Header search is inert; Fumadocs search disabled.
  - First cut: fixture/API search over dossiers, artifacts, threads, claims.

- [ ] **Breadcrumbs + cross-links**
  - Every object page navigates “up” (artifact → dossier, thread → targets).

- [ ] **Replace remaining placeholder panels**
  - Dossier tab stubs, thread/RFC reply stubs, disabled Nominate-for-RFC, etc.

---

## I. Later / policy-heavy (track, don’t start early)

- [ ] **Requirements Matrix artifact type** (CONCEPT §9) — **superseded**: use Claims + citations instead (see §E).
- [ ] **Auth + real-identity policy hooks** (CONCEPT §8.6) — after impersonation era.
- [ ] **Reputation layer** for non-scorable contributions (CONCEPT §8.2).
- [ ] **Charter / Constitution as living gated artifact** — migrate from static page when artifact IA exists.
- [ ] **Anti-gaming / scoring leaderboard policy**.
- [ ] **Moderator tools + audit logs**.
- [ ] **External artifact whitelist** (CONCEPT App D) — deferred until evidence/editor bridge solid.

---

## Notes (do not treat as separate issues)

- Spec-compliance page/route appears **already removed** from `routes.tsx` / header — not listed above.
- Three parallel content systems today: Fumadocs `/docs`, static About/FAQ/Constitution, JSON page editor — unify deliberately, don’t accidentally fork a fourth.
- Thread-first principle: no per-page micro comment sections; attach threads to targets.
- Lane hygiene and separation of powers (stewards merge; Red Team findings; adjudicators resolve claims) are load-bearing CONCEPT constraints.
