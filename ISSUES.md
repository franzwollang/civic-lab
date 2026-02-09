# Issues / Task List

This file tracks known gaps in the current prototype and concrete next steps toward the vision in `CONCEPT.md` (Canon + Country Manuals, thread-first workflows, scorable claims, and Red Team / adjudication governance).

---

## Immediate issues (cleanup / correctness)

- [ ] **Add a Home preamble (purpose + how to use this site)**
  - **Goal**: Help new users understand what Civic Lab *is*, why it exists, and how Canon vs Manuals + Threads/RFCs fit together.
  - **Reference**: `CONCEPT.md` (esp. “Design Goals”, “Two-channel corpus”, “Threads are primary”, “Scorable claims”, “Red Team system”).
  - **Acceptance**:
    - A short “What is this?” section near the top of `/` that explains:
      - **Canon** = truth-first ideal systems/specs (definitions, mechanisms, invariants).
      - **Country Manuals** = execution + realpolitik, with **lane hygiene** (Descriptive / Prescriptive / Alignment).
      - **Threads are primary**; RFCs are promoted threads with revision sets.
      - **Descriptive artifacts** use **scorable claims**; **Red Team** provides adversarial review; **Adjudicators** resolve contested claims.
    - Links to 1–2 exemplar pages in the prototype (e.g. a Dossier, a Descriptive artifact, a Thread/RFC, a Red Team review).

- [ ] **Editor: ensure robust keyboard navigation for void embed nodes**
  - **Context**: Making embeds (e.g. `math_inline`, `math_block`) `void` improves diffing/serialization, but Slate won’t automatically give you intuitive caret movement.
  - **Acceptance**:
    - Arrow keys can enter/exit inline void nodes predictably from both sides.
    - Up/Down arrows can move through/around inline void nodes (not just Left/Right).
    - Block void nodes support moving to the previous/next block with Up/Down at start/end edges.
    - Behavior is consistent across `math_inline`, `math_block`, and future void blocks (`mermaid_block`, `procedure_block`, `code_block`).

- [ ] **Editor: define copy/paste + plain-text export behavior for void embed nodes**
  - **Context**: With payload stored on element props (`latex`/`code`) instead of children text, “natural” copy/paste and plaintext export won’t happen automatically.
  - **Acceptance**:
    - Copying a void node produces a reasonable textual representation (e.g. `$...$`, `$$...$$`, fenced blocks) when pasted into a plain text destination.
    - Pasting a textual representation back into the editor round-trips into the correct node type (where appropriate).
    - Define a canonical “export to Markdown-ish text” for revision previews/diffs.

- [ ] **Editor: accessibility for rendered embeds (MathJax/Mermaid/Procedure/Code)**
  - **Context**: Rendered SVG/HTML embeds need explicit accessibility affordances.
  - **Acceptance**:
    - Render containers have meaningful labels (e.g. `aria-label` / `aria-describedby`) and don’t become “blank” for screen readers.
    - Keyboard users can focus/select/remove an embed without requiring a mouse.
    - Any generated HTML (e.g. pseudocode) is sanitized before insertion into the DOM.

- [ ] **Remove the “spec” page and header link**
  - **What to remove**:
    - Route: `src/app/routes.tsx` → `/spec-compliance`
    - Page: `src/app/pages/spec-compliance.tsx`
    - Header link: `src/app/components/header.tsx` (“Spec ✓”)
  - **Acceptance**:
    - No remaining nav links to `/spec-compliance`.
    - No dead routes.
    - No “Spec Compliance Checklist” UI in the app.

---

## Observations from current prototype (why it feels patchy)

The UI is a useful “high-fidelity sketch”, but much of the current flow is **hardcoded demo content** and **placeholder navigation**:

- **Header navigation is mostly non-functional**: `Canon`, `Manuals`, `Dossiers`, `Threads` all link to `/` (`src/app/components/header.tsx`).
- **Sidebar navigation is partially stubbed**: Threads/RFCs links point back to the dossier overview route, not to real lists (`src/app/components/sidebar-nav.tsx`).
- **Dossier / artifact / thread pages are mostly static**:
  - Dossier header fields are hardcoded (“US Voting Implementation Guide”, steward, tags, lane).
  - Tabs contain placeholders (“Thread list view would appear here”, etc.) (`src/app/pages/dossier-overview.tsx`).
  - Artifact pages show fixed content and fixed linked thread IDs (`src/app/pages/artifact-page.tsx`, `src/app/pages/descriptive-artifact.tsx`).
  - Thread/RFC pages assume a single dossier and fixed targets (`src/app/pages/thread-page.tsx`, `src/app/pages/rfc-thread-page.tsx`).
  - Dashboard values are static, used as a visual mock (`src/app/pages/dashboard.tsx`).

This is fine for a prototype, but it’s now blocking: the app doesn’t yet express the **information architecture** described in `CONCEPT.md`.

---

## Roadmap tasks (move toward `CONCEPT.md` vision)

### IA + navigation (make the “two-channel corpus” real)

- [ ] **Define top-level routes that match the concept**
  - **Canon index** (browse Canon dossiers)
  - **Manuals index** (browse Country Manuals by country; stewards, lanes)
  - **Dossiers index** (optional unified view with filters)
  - **Threads index** (thread-first entry point)
  - **About / Concept** (short, user-facing summary; `CONCEPT.md`-derived)

- [ ] **Make header links and sidebar links point to real pages**
  - Replace placeholder `/` links with the correct destinations.
  - Decide whether “Dossiers” is redundant if Canon/Manuals already list dossiers.

- [ ] **Clarify object taxonomy in UI**
  - Align terms to `CONCEPT.md`: **Dossier**, **Artifact**, **Thread**, **RFC**, **RevSet**, **Claim**, **Finding**, **Accepted Risk**.
  - Ensure “lanes” apply where intended (Manual artifacts), and Canon has its own artifact types (Mechanism, Metric, Failure Mode, etc.).

### Data model + content sourcing (get rid of hardcoded demo state)

- [ ] **Introduce a minimal data layer**
  - Start with in-repo fixture JSON/TS modules (no backend yet) for:
    - dossiers (kind: canon|country; title; tags; roles/stewards)
    - artifacts (type; lane for manuals only; references)
    - threads (state; targets; timeline posts)
    - RFCs + RevSets
    - claims (type; p/confidence; deadlines; criteria; sources; status)
    - findings (severity; likelihood; status; links)

- [ ] **Replace hardcoded copy with data-driven rendering**
  - Dossier headers, artifact content blocks, linked threads, dashboard stats, etc.
  - Keep the current demo content as fixtures, but make the UI render from data.

- [ ] **Establish stable IDs + linking rules**
  - Thread targets should support dossier / artifact / section-anchor / multi-target (per `CONCEPT.md`).
  - Decide how section anchors are represented (explicit anchors vs heading IDs).

### Thread-first workflows (make “threads are primary” actionable)

- [ ] **Implement Thread lifecycle states + UI**
  - States: `open`, `rfc`, `review`, `decided`, `archived` (per `CONCEPT.md`).
  - Filtering and “promote to RFC” mechanics (permissions can be mocked initially).

- [ ] **Implement RFC promotion + RevSets as first-class objects**
  - RFC header fields: scope, intent, acceptance criteria, review requirements.
  - RevSet list and “current revision” indicator; basic diff preview can be stubbed initially.

### Descriptive lane: scorable claims (core credibility mechanism)

- [ ] **Represent claims as structured objects with required fields**
  - `text`, `type`, `as_of/deadline`, `probability/confidence`, `resolution_criteria`, `preferred_sources`, `adjudication_rule`, `status`, `links` (from `CONCEPT.md`).

- [ ] **Add claim resolution + adjudication scaffolding**
  - “Request adjudication” should create a thread or queue item linked to claim(s).
  - Track outcomes: resolved_true / resolved_false / ambiguous / invalidated / source_conflict.

- [ ] **Metrics: keep two families distinct**
  - Claim quality metrics vs forecast accuracy metrics (per `CONCEPT.md`).
  - Make UI compute from fixture data (even if simplistic at first).

### Red Team system (adversarial review with “teeth”)

- [ ] **Model Findings + Accepted Risk objects**
  - Findings should link to targets (artifact/claim IDs) and be discoverable from threads/RFCs.
  - Accepted risk requires explicit rationale + triggers + signer + timestamp.

- [ ] **Add merge gating signals (even if mocked)**
  - Example: “Cannot merge while Critical finding is open unless Accepted Risk exists.”

### Requirements Matrix (Canon → Manuals linkage)

- [ ] **Create a minimal “Requirements Matrix” artifact type in Canon**
  - Rows: requirement name, definition, metrics/tests, typical interventions, failure modes.
  - Manual alignment artifacts link to requirement rows (not freeform text only).

### UX polish (tighten the prototype feel without boiling the ocean)

- [ ] **Search experience**
  - Decide scope: dossiers/artifacts/threads/claims.
  - Implement a basic search results page (fixture-backed).

- [ ] **Breadcrumbs and cross-links**
  - Ensure every object page can navigate “up” (artifact → dossier, thread → targets, etc.).

- [ ] **Remove/replace remaining placeholder UI**
  - Replace “would appear here” panels with at least a minimal list view backed by fixtures.

---

## Notes / principles (to avoid drifting away from the concept)

- **Thread-first**: avoid per-page micro comment sections; attach threads to dossier/artifact/anchor targets instead.
- **Lane hygiene** (Manuals): keep Descriptive / Prescriptive / Alignment separate; reference across lanes explicitly.
- **Scorability**: descriptive content should be resolvable and scoreable where possible; treat ambiguity/invalidated as first-class outcomes.
- **Separation of powers**: stewards merge manual content; Red Team issues findings; adjudicators resolve claims; do not collapse these roles into one UI concept.
