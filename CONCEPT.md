# Spec Draft — Canon + Country Manuals + Threads/RFC + Red Team + Scored Claims

> Engineering-lab style governance + knowledge system.
>
> **Core idea:** A collaborative forum/wiki hybrid with a strict separation between (A) a **Canon** of ideal systems (truth-first specs) and (B) **Country Manuals** (execution + realpolitik) built around scorable, resolvable claims. The site is thread-first; actionable changes are handled via **RFC threads** with revision sets.

---

## 0. Design Goals

### Primary goals
- **Truth-first Canon:** produce internally consistent, mechanism-grounded, testable designs for ideal political/economic/cultural systems (including **parameterized** mechanisms adaptable to circumstance without embedding a specific country’s politics).
- **Reality-calibrated Manuals:** country-specific planning that integrates realpolitik (amoral, objective-driven), while explicitly tracking alignment impact against Canon.
- **Epistemic hygiene:** empirical content (Manual Descriptive + eligible Canon trends) is constituted of **resolvable facts** and **probabilistic predictions** with explicit timelines and criteria; Alignment uses **requirement claims** that cite Canon.
- **High-signal collaboration:** threads are primary; structured change workflows are optional (“promote to RFC”).
- **Transparency + diligence:** red-team review and accepted-risk mechanisms scale credibility as the project gains influence.

### Non-goals
- Persuasion/organizing as a primary function (persuasion happens externally).
- Unstructured “comment sections” attached to every micro-page.
- Collapsing evaluation power into country merge authority (no local capture of truth/adjudication).

### Design invariants (load-bearing)
1. **Area split is epistemic**, not cosmetic: Canon ≠ realpolitik; Manuals ≠ ideal theory.
2. **Merge authority follows the artifact’s Collection** (Canon vs country Manual), not the thread’s home dossier.
3. **Only 1:1 RFC↔artifact mappings merge content**; wrappers coordinate, they do not write revisions.
4. **Lanes are immutable** on Manual artifacts; cross-lane work is by **links**, not mixed bodies.
5. **Claims are typed by profile**; profile must be legal for the owning artifact’s Area/lane.
6. **Scores and reputation are advisory**; stewards/owner retain discretionary permissions.
7. **Separation of powers:** stewards merge Manuals; owner/editors govern Canon; Red Team findings; adjudicators resolve claims — none absorbs another’s role.

---

## 1. Site Architecture

### 1.1 Two-channel corpus (Areas)

#### A) Canon Area (Ideal)
- **Purpose:** define the universal ideal framework (one Canon Collection) using parameterized models adaptable to circumstances.
- **Tone:** formal, definitions-first, mechanism + invariants + metrics.
- **Governance:** owner has final veto; editors may curate and shepherd RFCs.
- **No realpolitik drift:** Canon does not depend on current single-country politics; implementation constraints live in Manuals.

#### B) Country Manuals Area (Execution + Realpolitik)
- **Purpose:** country-specific documents for incremental alignment with Canon while integrating realpolitik objectives.
- **Tone:** operational, risk-aware, amoral analysis permitted (objective-conditional).
- **Governance:** each **country Collection** has one or more **Stewards** with merge authority for that Collection; owner retains meta-policy veto only.

### 1.2 Navigation chrome
- Top-level split: **Canon** vs **Country Manuals**.
- Manuals entry: **map + list/search** → country Collection.
- Every **Collection** uses the **same splash/dashboard** layout (Canon and each Manual).
- **Dossiers** use **subforum** UX (threads primary).

---

## 2. Core Information Units

### 2.0 Areas and Collections
- **Area:** `canon` | `manuals`.
- **Collection:** Canon Area → **singleton** Collection; Manuals Area → **one Collection per country** (`country_code`).
- A country Manual is always a **Collection of dossiers**, never a single dossier.

### 2.1 Dossiers (subforum-owning semantic units)
A **Dossier** belongs to a Collection and owns:
- a set of artifacts
- a **subforum** (threads whose *default* home is this dossier)
- metadata, tags, optional local roles, dossier dashboard

Examples:
- Canon: `Voting Systems`, `Fiscal Capacity`, …
- US Manual: `Federal Elections`, `State Election Administration`, … 

Dossiers are flexible semantic/functional cuts. **No enforced taxonomy templates** in v1 — Collections grow dossiers as needed. Optional free tags for navigation; seed data may show example cuts (not normative schema).

### 2.2 Artifacts (revisioned documents)
Artifacts are typed, revisioned documents within a dossier.

Illustrative types: Concept/Glossary, Mechanism, System Design, Failure Mode, Metric, Case Study, Country Baseline Snapshot, Reform Ladder / Alignment Step, Descriptive Brief, Prescriptive Strategy Note, …

- **Manual artifacts:** exactly one immutable **lane** — Descriptive | Prescriptive | Alignment.
- **Canon artifacts:** no Manual lane.
- Body = `ArtifactRevision` history (`content_json` + block index/hashes); UI “pages” are views, not a separate domain type.

### 2.3 Sections
Stable **Section** identities (synced from document structure, e.g. headings) exist so threads and citations can target finer grain than whole artifacts.

---

## 3. Threads Are Primary

### 3.1 Thread lifecycle
A thread is the default social object. Not all threads produce changes.

States:
- `open` (discussion)
- `rfc` (promoted; revision mechanics enabled on merging RFCs)
- `review` (optional explicit review window)
- `decided` with outcome **`merged` | `rejected` | `parked`**
- `archived`

### 3.2 Home vs targets
- Every thread has a **home dossier** (subforum placement, defaults, notifications).
- Threads may **target** one or more: Dossier, Artifact, Section (via `ThreadTarget`).
- **Home may differ from some targets** — dossiers are not islands; integrative threads are allowed.
- Targeting across Collections/Areas is allowed for **discussion**. **Merge authority** still follows each artifact’s Collection (see §3.4).

### 3.3 Promote to RFC
Any thread can be promoted to an **RFC thread**.

**RFC ↔ artifact rule:** only a **1:1** RFC–artifact mapping may merge content into that artifact.

- **Single-artifact change:** one RFC; RevSets propose `ArtifactRevision`s; merge sets `current_revision_id`.
- **Multi-artifact change:** RFC is **upgraded** to a **wrapper parent** + **sub-RFCs** (one per artifact). Only sub-RFCs merge content.
- **Wrapper constraint:** all sub-RFCs in a wrapper MUST target artifacts in the **same Collection**. Cross-Collection programs use linked threads/citations, not one wrapper.
- **Parent `decided`:** only when all children are `decided`.
- **Accepted Risk:** attaches to the **merging (leaf) RFC** only.

Promotion behavior:
- preserves discussion history
- RFC header: scope, intent, acceptance criteria, review requirements; child links if wrapper
- RevSets on each **merging** RFC

Permissions:
- Contributors may **nominate** and may submit RevSets on RFCs they can participate in.
- Canon: editors/owner **promote**.
- Manuals: **stewards** of that Collection **promote** (Canon editors do not promote Manual RFCs by default).
- Owner retains meta-policy veto; Canon merge rules in §3.4.

### 3.4 Merge authority (follows the artifact)

| Artifact location | Who may merge a leaf RFC | Accepted Risk signer |
|---|---|---|
| Canon, routine | **Editors** (if no open Critical Finding) | Owner if Accepted Risk required |
| Canon, restricted | **Owner only** — Charter/governance artifacts, or any RFC with open Critical Finding / Accepted Risk path, or artifact flagged `owner_merge_only` | Owner |
| Country Collection | **Stewards** of that Collection | Steward |

- Owner may **revert** any Canon merge (audit-logged).
- Thread home dossier never overrides this table.
- v1 merge gate elsewhere: Critical Finding blocks leaf merge unless Accepted Risk (§7.6).

---

## 4. Country Manual Lanes (Epistemic Hygiene)

### 4.1 Lane taxonomy
Every Manual artifact has exactly one **primary lane** (immutable after create):
- **Descriptive** — intel / current state / forecasts → **empirical claims**
- **Prescriptive** — actor-specific objective-conditional strategy → **card fields**, not a claim bundle
- **Alignment** — steps to advance Canon → **requirement claims** citing Canon

**Default:** single-lane artifacts; cross-lane work via citations/links.

**Composites:** an artifact that links across lanes may receive a **computed** soft “bridge/composite” label. Lane-specific automations may treat pure vs composite differently. No hard `bridge` type.

### 4.2 Lane-specific semantics

#### Descriptive
- Primarily **empirical claims**.
- No vague language unless quantified (thresholds, windows).
- May structure multiple actors/objectives as inference, not a single objective.

#### Prescriptive
- Names **actor/owner** and **objective**; objective-conditional and amoral.
- Feasibility, blowback risk, reversibility, confidence, second-order risks, alignment delta.
- May **cite** empirical claims; does not own claim rows as its primary constitution.

#### Alignment
- Implicit objective: increase Canon alignment.
- **Requirement claims** with Canon citations; sequencing/dependencies.
- May cite descriptive/prescriptive artifacts.

---

## 5. Scorable Claims System

Claims are a shared abstraction with **profiles**. A claim is owned by an **artifact** (optional section link). **Profile must be legal** for that artifact:

| Owning artifact | Legal claim profiles |
|---|---|
| Manual Descriptive | `empirical` |
| Manual Alignment | `requirement` |
| Manual Prescriptive | none (cite only) |
| Canon | `empirical` only (with `scope`) |

### 5.1 Profiles

| Profile | Purpose |
|---|---|
| **`empirical`** | Resolvable world-knowledge (facts / forecasts / models) |
| **`requirement`** | Locally interpreted Canon-linked obligations / alignment steps |

### 5.2 Empirical claims
Types: fact | forecast | model (implication graph deferred).

Fields: `text`, `type`, `as_of` XOR `deadline`, `probability` (required for scored forecasts), `resolution_criteria`, `preferred_sources`, `adjudication_rule`, `status` (`open | resolved_true | resolved_false | ambiguous | invalidated | source_conflict`), `links`. Canon: `scope` (`global | regional`).

### 5.3 Requirement claims
Fields: `text`, required **`canon_citations`**, optional deps / expected time-to-effect / confidence, `resolution_criteria`, `status` (`open | accepted | satisfied | failed | superseded | invalidated | disputed`), `links`.

Scoring: **quality metrics only** (no Brier/log).

### 5.4 Scoring toolkit (empirical forecasts)
Log (primary), Brier, calibration, sharpness, skill vs baseline; optional later WIS for quantiles. Clamp p ∈ [0.01, 0.99]; recency windows.

### 5.5 Metrics split
- **Quality:** all profiles (invalidated/dispute rates, time-to-resolution, citation density, specificity).
- **Forecast accuracy:** empirical forecasts that resolve true/false with p only.

### 5.6 Public signals
Public, tied to users and dossiers/collections; **advisory**; show n, window, baselines.

### 5.7 Canon empirical scope (anti-smuggle)
Country-independent trends only (negative definition: what does not belong in a Manual).

- Prefer `scope = global`.
- `scope = regional` uses preferred `region_code` from a small curated set (UN M49 macro-regions + common blocs as needed, e.g. `EU`) and/or free-text `region_label` when no code fits.
- Anti-smuggle (primary guardrail): **Force Manual** if criteria or preferred sources name a **single state’s** institutions, elections, parties, or agencies.
- Borderline → adjudicator flag.

### 5.8 Empirical resolution edge cases
Ambiguous/source_conflict: usually no accuracy score. Invalidated: quality metric. Criteria frozen per claim against goalpost moving.

### 5.9 Baselines and anti-gaming (defaults)
**Baselines (forecast skill):** until category-specific baselines exist, skill is vs a disclosed default — historical base rate for that claim family if recorded, else binary **p = 0.5**. Always show which baseline was used.

**Anti-gaming (v1):**
- Scores never grant permissions (advisory only).
- Public skill/leaderboard panels require **n ≥ 20** resolved scored forecasts and use **rolling windows**.
- Resolved claims are not hard-deleted to erase scores (use invalidate/supersede).
- Owner may hide accounts from boards for abuse (audit-logged). Tighter policy may come later.

---

## 6. Manual “Card” Schemas (Lane-Specific)

### 6.1 Descriptive
Lane, country/region tags, empirical claims table, optional actors/objectives, reality-value notes, evidence pack.

### 6.2 Prescriptive
Lane, actor/owner, objective, plan, feasibility, blowback, reversibility, confidence, second-order risks, alignment delta; may cite empirical claims.

### 6.3 Alignment
Lane, requirement claims (Canon citations), step definition, dependencies, risks, confidence, expected time-to-effect, links to descriptive/prescriptive artifacts.

---

## 7. Red Team System

### 7.1 Purpose
Adversarial testing (failure modes, exploits, counterexamples) for diligence and credibility.

### 7.2 Flag
Threads (especially RFCs) may be marked **Red Team Review**.

### 7.3 Findings
Only Red Team members create **Findings**. Always tied to a **thread** (context). Targets via join (artifact, claim, section, …).

Fields: title, severity (`low|med|high|critical`), likelihood, evidence, attack path / failure mode, status (`open | mitigated | accepted_risk | disputed`).

Status `accepted_risk` on a Finding should correspond to an **AcceptedRisk** record on the relevant merging RFC when used to pass a merge gate.

### 7.4 Candidate → Finding
Any user may flag a post as candidate; Red Team triages and may promote (provenance retained).

### 7.5 Timeline UX
Typed posts: Finding | Mitigation response | Comment. Filters: Findings only / Findings+responses / All. Optional Findings index sidebar.

### 7.6 Merge gates (“teeth”)
On a **merging (leaf) RFC**:
- Block merge while any **Critical** Finding targeting that RFC’s artifact (or the RFC thread) is `open`, **unless** an **AcceptedRisk** exists on that RFC.
- Higher severities only for v1; expanding gates is a policy tweak later.
- Wrapper RFCs do not merge; they inherit child outcomes.

AcceptedRisk: description, rationale, evidence considered, reopen triggers, timestamp, signer (merge-authority role per §3.4).

---

## 8. Global Oversight: Red Team + Adjudication

### 8.1 Rationale
Evaluation power is global and independent from per-country merge authority (anti-capture).

### 8.2 Global Red Team
- Not country-scoped; may review any Collection.
- Findings cannot be suppressed by stewards.
- No merge authority.

### 8.3 Global Adjudicators
Resolve contested / ambiguous claims.

- **Empirical statuses:** resolved_true/false, ambiguous, invalidated, source_conflict (+ rationale).
- **Requirement statuses:** accepted, satisfied, failed, superseded, invalidated, disputed (+ rationale).
- Maintain a resolution playbook; improve over time.
- Do **not** merge content; stewards do **not** override adjudicated outcomes.

### 8.4 Source hierarchy (empirical)
Preferred sources on the claim, plus general hierarchy:
1) primary official releases (documented caveats)
2) multiple reputable independents
3) transparent methodology datasets
4) credible investigative reporting
5) single-source (low confidence; may stay ambiguous)

Disagreement → outcome with rationale or `source_conflict`; optional follow-up claims/RFCs.

### 8.5 Appeals
Reconsideration with new evidence; logged; provenance kept.

### 8.6 Identity / stewardship legitimacy (policy)
Real-identity accounts (policy). Country stewards: from the country or long-term ties (owner discretion).

---

## 9. Governance & Roles

### 9.1 Roles
- **Owner:** Canon final say / revert; appoint stewards; meta-policy veto; Charter; restricted Canon merges (§3.4).
- **Editors (Canon):** curate; shepherd; promote Canon RFCs; **merge routine Canon** RFCs (§3.4).
- **Stewards (per country Collection):** promote/merge Manual RFCs in that Collection; local review norms.
- **Red Team:** Findings; promote candidates.
- **Adjudicators (global):** claim resolution.
- **Contributors:** threads, nominate RFCs, submit RevSets when participating.
- **Observers:** read; lightweight reactions on posts; flag candidate findings.

### 9.2 Reputation (non-scorable work)
Separate from claim scores. Signals: merged RevSets, review labor, endorsements, attribution quality, red-team/adjudication work. Scope by **dossier/topic** (roll up to Collection). Advisory only. Subject to §5.9 anti-gaming floor (no permission coupling; abuse hiding).

### 9.3 Charter
Site-wide hard gate, preferred as a living Canon artifact with `owner_merge_only`.

**Minimum premises (normative until full prose lands):**
- Canon excludes divine authority as an epistemic premise for governance design.
- Manuals may treat religion as a political force/institution, not as epistemic authority.
- Separation of powers and advisory scores as in §0 invariants.

Full Charter wording is **content** authored via ordinary Canon RFC process, not an open architecture question.

### 9.4 Moderation and audit (defaults)
- **Append-only audit log** for: merges, reverts, claim status changes, adjudications, AcceptedRisk, role changes, board-hide actions.
- Soft-delete for ordinary posts; **no silent hard-delete** of Findings, Claims, AcceptedRisk, or merged RevSets.
- Collection stewards moderate within their Manual; Owner (and later optional global mods) for site-wide / Canon.

---

## 10. Canon ↔ Manual linkage

No Requirements Matrix entity. Alignment uses **requirement claims** citing Canon via attribution/citation tooling. Optional matrix-like **views** are queries, not a second model.

---

## 11. Collection dashboard (shared chrome)

Same layout for Canon and each Manual; **data scope = that Collection**. Suggested panels (v1):
- Dossier index / health
- Open threads & RFCs (incl. Critical findings count)
- Empirical claim quality (+ forecast accuracy where applicable)
- Manuals only: lane coverage; requirement-claim satisfaction snapshot
- Recent Red Team activity

Exact widget set may gain panels later; **chrome parity** across Collections is the invariant.

---

## 12. Defaults log (resolved gaps)

Formerly open design questions — **defaults adopted** (revisit only with cause):

| Topic | Default |
|---|---|
| Dossier taxonomy | No enforced templates; free tags + organic growth |
| Regional labels | Curated `region_code` when possible + optional free-text `region_label`; anti-smuggle rule is authoritative |
| Forecast baselines | Disclosed default (family base rate or 0.5) until richer baselines exist |
| Anti-gaming | Advisory scores; n≥20 for boards; rolling windows; no score-wiping deletes |
| Charter prose | Living `owner_merge_only` Canon artifact; minimum premises in §9.3; full text via RFC |
| Canon editor merge | Editors merge routine; Owner for restricted / Critical-AcceptedRisk / `owner_merge_only` |
| Manual promote | Stewards only (not Canon editors) |
| Moderation / audit | Append-only audit; soft-delete posts; stewards local, owner global |
| Observer “react” | Lightweight post reactions; no score weight |
| Model→forecast graph | Still deferred (post claim UX) |

---

## Appendix A — Minimal Data Model (sketch)

### Hierarchy
- Area { id, kind: canon | manuals }
- Collection { id, area_id, country_code?, title }
- Dossier { id, collection_id, title, tags }
- Artifact { id, dossier_id, type, title, lane?, current_revision_id }
- ArtifactRevision { id, artifact_id, parent_revision_id?, content_json, blocks, doc_root_hash, author_id, created_at }
- Section { id, artifact_id, stable_key, title }

### Collaboration
- Thread { id, home_dossier_id, state, decision_outcome?, is_redteam, parent_thread_id?, merge_artifact_id? }
- ThreadPost { id, thread_id, author_id, type, body, created_at }
- ThreadTarget { thread_id, target_kind, target_id }
- RevSet { id, thread_id, version, artifact_revision_id, author_id, created_at }
- Claim { id, artifact_id, section_id?, profile, …profile fields… }
- Finding { id, thread_id, severity, likelihood, status, … }
- FindingTarget { finding_id, target_kind, target_id }
- AcceptedRisk { id, rfc_thread_id, rationale, triggers, signer_id, created_at }
- User { id, display_name, roles[] }  // impersonation in prototype

### Evidence
- Attribution { … }
- Term { scope: global | dossier | collection/country, … }

---

## Appendix B — UI Outline (sketch)

- Area entry → Collection splash/dashboard → Dossier subforum → Artifact reader/editor → Thread/RFC
- Thread: home, targets, parent/child RFC links, typed timeline, Findings filters
- Artifact: lane badge (Manuals), claims panels by profile, evidence/citations/terms

---

## Appendix C — Supported syntaxes and block types (MVP)

### Native
- Markdown blocks (paragraph, heading, list, table, quote, code) — lists/tables may lag in editor MVP
- `math_inline`, `math_block`
- `mermaid_block`
- `procedure_block` (pseudocode.js initially)
- `evidence_block` (text/data/math + attribution)
- `citation_inline`, `term_inline`

### Platform-lite
- `data_block` for JSON/YAML/TOML/CSV (highlight/validate, no execution)

### External-by-reference
- `external_artifact` (Appendix D)

---

## Appendix D — External artifact reference policy (whitelist + immutability)

### D.1 Goals
Durable, auditable, de-duplicable references; general identity vs immutable snapshot.

### D.2 Required fields
`provider`, `general_id`, `specific_id`, `display_title`, optional `summary`, `license`.

### D.3 Whitelist (examples)
GitHub commit SHA for immutable; Zenodo DOI+version; arXiv id+vN; OSF versioned snapshot where possible.

### D.4 Validation
Reject missing general/specific forms; normalize IDs; store parsed components for search/grouping.

---

## Appendix E — Evidence, attributions, and terms

### E.1 Attributions
Registry of sources (`url|book|paper|report|other`); optional `immutable_ref`; versioned registry. Citations: attribution id + optional locator + note.

### E.2 Terms
Registry: scope `global | dossier | country/collection`; types local_alias | platform_construct | disambiguation; tentative|accepted; aliases; definitions.

### E.3 Evidence blocks
In-doc excerpts bound to attributions (text/data/math). Not a substitute for Claims.

### E.4 Separation of concerns
| Concern | Object |
|---|---|
| Source identity | Attribution |
| Vocabulary | Term |
| Show excerpt | Evidence block |
| Score / require | Claim |
| Heavy external work | `external_artifact` |
