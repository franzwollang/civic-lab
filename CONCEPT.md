# Spec Draft — Canon + Country Manuals + Threads/RFC + Red Team + Scored Claims

> Engineering-lab style governance + knowledge system.
>
> **Core idea:** A collaborative forum/wiki hybrid with a strict separation between (A) a **Canon** of ideal systems (truth-first specs) and (B) **Country Manuals** (execution + realpolitik) built around scorable, resolvable claims. The site is thread-first; actionable changes are handled via **RFC threads** with revision sets.

---

## 0. Design Goals

### Primary goals
- **Truth-first Canon:** produce internally consistent, mechanism-grounded, testable designs for ideal political/economic/cultural systems.
- **Reality-calibrated Manuals:** country-specific planning that integrates realpolitik (amoral, objective-driven), while explicitly tracking alignment impact against Canon.
- **Epistemic hygiene:** descriptive content is constituted of **resolvable facts** and **probabilistic predictions** with explicit timelines and criteria.
- **High-signal collaboration:** threads are primary; structured change workflows are optional (“promote to RFC”).
- **Transparency + diligence:** red-team review and accepted-risk mechanisms scale credibility as the project gains influence.

### Non-goals
- Persuasion/organizing as a primary function (persuasion happens externally).
- Unstructured “comment sections” attached to every micro-page.

---

## 1. Site Architecture

### 1.1 Two-channel corpus

#### A) Canon (Ideal)
- **Purpose:** define the universal ideal framework (one canon) using parameterized models adaptable to circumstances.
- **Tone:** formal, definitions-first, mechanism + invariants + metrics.
- **Governance:** owner has final veto; editors may curate.
- **No realpolitik drift:** Canon does not depend on current politics; implementation constraints live elsewhere.

#### B) Country Manuals (Execution + Realpolitik)
- **Purpose:** country-specific documents for incremental alignment with Canon while integrating realpolitik objectives.
- **Tone:** operational, risk-aware, amoral analysis permitted (objective-conditional).
- **Governance:** each country has one or more **Stewards** with merge authority; owner retains meta-policy veto only.

---

## 2. Core Information Units

### 2.1 Dossiers (subforum-owning semantic units)
A **Dossier** is the primary container that owns:
- a set of artifacts/pages
- a **subforum** (thread collection)
- metadata, tags, roles, dashboards

Examples:
- Canon dossier: `Voting Systems`
- Country dossier: `Mexico Manual`

### 2.2 Artifacts (content objects)
Artifacts are structured documents/pages within a dossier.

Common artifact types:
- Concept / Glossary
- Mechanism
- System Design
- Failure Mode
- Metric
- Case Study
- Country Baseline Snapshot
- Reform Ladder / Alignment Step
- Descriptive Brief (claims bundle)
- Prescriptive Strategy Note

Artifacts should have version history and references to threads/RFCs that affected them.

---

## 3. Threads Are Primary

### 3.1 Thread lifecycle
A thread is the default social object. Not all threads produce changes.

States:
- `open` (discussion)
- `rfc` (promoted to RFC; revision mechanics enabled)
- `review` (optional explicit review window)
- `decided` (merged / rejected / parked)
- `archived`

#### Thread targets (granularity)
Threads can attach to one or more targets:
- **Dossier** (default)
- **Artifact/Page**
- **Section anchor** (e.g., `Voting Systems → Metrics → Auditability`)
- **Multi-target** (one thread touches multiple artifacts/anchors)

This avoids brittle per-page comment sections while still supporting precise, auditable discussion.

### 3.2 Promote to RFC
Any thread can be promoted to an **RFC thread**.

Promotion behavior:
- preserves full discussion history
- inserts an **RFC header** at top:
  - scope (targets: dossiers/pages/anchors)
  - intent (what changes if merged)
  - acceptance criteria / definition of done
  - review requirements (if any)
- enables **Revision Sets (RevSets)**: v1, v2, v3…

Permissions:
- Normal users can **nominate** a thread for RFC.
- Trusted users/editors/stewards can **promote**.
- Owner retains veto on Canon merges.

---

## 4. Country Manual Lanes (Epistemic Hygiene)

### 4.1 Lane taxonomy
Every Country Manual artifact has exactly one **primary lane**:
- **[Descriptive]** (intel / current state / forecasts)
- **[Prescriptive]** (actor-specific objective-conditional strategy)
- **[Alignment]** (steps intended to advance Canon targets)

**Default policy:** keep lanes as separate artifacts; cross-lane references via citations/links.

Bridge artifacts may exist explicitly (e.g., quarterly brief), but must preserve lane-separated sections.

### 4.2 Lane-specific semantics

#### Descriptive
- Constituted of scorable claims (facts + forecasts + model implications).
- No vague language (“increasing”, “significant”) unless made quantitative with thresholds and windows.
- May include multiple actors/objectives as inferred structure, not a single objective.

#### Prescriptive
- Explicitly names **actor/owner** and **objective**.
- Plans are objective-conditional and amoral.
- Includes feasibility, risk, reversibility, confidence, and an alignment delta.

#### Alignment
- Objective is implicitly global: increase alignment with Canon.
- Must link to Canon requirements and provide sequencing/dependencies.
- May reference descriptive and prescriptive realities via citations.

---

## 5. Scorable Claims System (Descriptive Lane)

### 5.1 Claim types
Every Descriptive artifact is a bundle of **Claim** objects.

Claim must be one of:
1. **Resolvable Fact** (time-stamped)
   - statement about world as-of date D
   - later verifiable/falsifiable
2. **Forecast** (probabilistic)
   - probability p
   - deadline T
   - resolution criteria
3. **Model/Conditional Claim**
   - not scored directly; must generate one or more forecast implications with resolution criteria

### 5.2 Mandatory claim fields
- `text`
- `type` (fact | forecast | model)
- `as_of` (facts) OR `deadline` (forecasts)
- `probability` (optional for facts; recommended as confidence)
- `resolution_criteria` (precise)
- `preferred_sources` (ranked)
- `adjudication_rule` (who/what resolves if sources conflict)
- `status` (open | resolved_true | resolved_false | ambiguous | invalidated | source_conflict)
- `links` (evidence, threads, related artifacts)

### 5.3 Scoring toolkit
Goal: prevent base-rate hedging by using a collection of complementary metrics.

For binary/categorical:
- **Log score** (primary; proper; punishes overconfidence)
- **Brier score** (secondary; interpretable)
- **Calibration** (reliability curve; optionally ECE)
- **Sharpness** (distribution of p)
- **Skill vs baseline** (e.g., Brier Skill Score; log-skill)

For numeric forecasts (optional later):
- require quantiles (e.g., 10/50/90)
- score via **WIS** (weighted interval score)
- track coverage + interval width

Practical policies:
- enforce or clamp p into [0.01, 0.99] for log-score stability
- use rolling windows + recency weighting

### 5.4 Metrics split: claim quality vs forecast accuracy
Some contributions will never resolve quickly (or cleanly). Track **two complementary metric families**.

#### A) Claim quality metrics (process + hygiene)
Applies to descriptive claims regardless of outcome.
- **Invalidated rate**: fraction of claims marked invalidated (bad criteria / ill-posed)
- **Ambiguity rate**: fraction ending ambiguous/source-conflict
- **Time-to-resolution**: median/mean time from creation → resolution
- **Citation density**: citations per claim (and per key claim)
- **Specificity score (optional)**: presence of thresholds, dates, sources (can be computed)

These discourage creating unresolvable or unfalsifiable claims.

#### B) Forecast accuracy metrics (truthfulness + calibration)
Applies to claims that resolve true/false with stated probabilities.
- Log/Brier, calibration, sharpness, skill vs baseline
- Report with sample size and recency window

### 5.5 Public performance signals
- Scores are public and tied to users/dossiers.
- Scores are **advisory signals**; permissions remain discretionary (owner/stewards retain judgment).
- Scores should be displayed with sample size, recency window, and baseline comparisons to reduce misinterpretation.

### 5.6 Resolution edge cases and scoring impact
- **Ambiguous / Source conflict**: typically does not score; remains visible as an epistemic record.
- **Invalidated**: indicates poor resolvability criteria; may carry a light penalty or be tracked separately as a quality metric.
- Resolution rules should be explicit per-claim to prevent retroactive goalpost moving.

- Scores are public and tied to users/dossiers.
- Scores are **advisory signals**; permissions remain discretionary (owner/stewards retain judgment).
- Scores should be displayed with sample size, recency window, and baseline comparisons to reduce misinterpretation.

### 5.5 Resolution edge cases and scoring impact
- **Ambiguous / Source conflict**: typically does not score; remains visible as an epistemic record.
- **Invalidated**: indicates poor resolvability criteria; may carry a light penalty or be tracked separately as a quality metric.
- Resolution rules should be explicit per-claim to prevent retroactive goalpost moving.

---

## 6. Manual “Card” Schemas (Lane-Specific)

### 6.1 Descriptive card
- `lane = Descriptive`
- scope: country/region + tags
- claims table (IDs, probability/confidence, deadlines)
- actors & inferred objectives (optional structured)
- reality value: incentive insight, forecast relevance, model value
- evidence pack

### 6.2 Prescriptive card
- `lane = Prescriptive`
- actor/owner
- objective
- plan outline
- feasibility
- blowback risk
- reversibility
- confidence
- second-order risks
- alignment delta (helps/neutral/harms + notes)

### 6.3 Alignment card
- `lane = Alignment`
- canon targets (requirements matrix rows)
- step definition
- dependencies
- risks
- confidence
- expected time-to-effect
- interaction notes (links to descriptive/prescriptive artifacts)

---

## 7. Red Team System

### 7.1 Purpose
Institutionalize adversarial testing (failure modes, exploits, counterexamples). Provides diligence, transparency, and credibility.

### 7.2 Red-team thread flag
A thread (especially an RFC) may be marked as **Red Team Review**.

### 7.3 Finding objects (high-signal)
Only Red Team members can create **Findings**.

Finding fields:
- title
- target (artifact/claim IDs)
- severity (low/med/high/critical)
- likelihood
- evidence links
- attack path / failure mode
- status (open | mitigated | accepted_risk | disputed)

### 7.4 Promotion flow (Observer → Finding)
- Any user can flag a comment as **candidate finding**.
- Candidates enter a triage queue.
- Red Team may **Promote** candidate → creates a structured Finding card linked to provenance.

### 7.5 UI/UX (single timeline + typed posts)
- One thread timeline; posts have types:
  - Finding (card)
  - Mitigation response (card linked to a finding)
  - General comment (standard)
- Thread view filters:
  - Findings only
  - Findings + responses
  - All
- Optional: left-side Findings index for fast navigation.

### 7.6 “Teeth” / merge gates
For high-impact merges:
- require no unresolved Critical findings OR explicit **Accepted Risk** sign-off by owner/steward.

Accepted Risk object:
- description
- rationale
- what evidence was considered
- triggers that would reopen
- timestamp + signer

---

## 8. Global Oversight: Red Team + Adjudication

### 8.1 Rationale
To prevent local ideological bubbles and local capture, **evaluation power** is global and independent from per-country merge authority.

### 8.2 Global Red Team (independent)
- Red Team membership is **global** (not country-scoped).
- Red Team can review any dossier/RFC across Canon and Manuals.
- Red Team Findings cannot be overridden or suppressed by country stewards.
- Red Team does not own merge authority; it supplies adversarial evaluation, mitigations, and gating signals.

### 8.3 Global Adjudicators (claim resolution)
Adjudicators resolve claim outcomes when sources conflict or criteria are ambiguous.

Responsibilities:
- resolve claims to: resolved_true / resolved_false / ambiguous / invalidated / source_conflict
- publish rationale on contested resolutions
- maintain a resolution playbook and improve it over time

Constraints:
- adjudicators do **not** merge content (separation of powers)
- country stewards do **not** override adjudicated outcomes

### 8.4 Resolution hierarchy (source-of-truth policy)
Each claim includes preferred sources, but adjudication follows a general hierarchy (customizable by claim category):
1) primary official releases (with documented caveats)
2) multiple reputable independent sources
3) transparent methodology datasets (academic/NGO)
4) credible investigative reporting
5) single-source claims (allowed with low confidence; may remain ambiguous)

When reputable sources disagree:
- adjudicator may select an outcome with rationale, or mark **source_conflict**
- optionally spawn follow-up claims/RFCs to reduce uncertainty

### 8.5 Appeals and reconsideration
- Any user or steward may request reconsideration with new evidence.
- Reconsideration outcomes are logged; provenance remains visible.

### 8.6 Identity and stewardship legitimacy (policy)
- Registered accounts must be real-identity verified (policy-level requirement).
- Country stewards should be from the country or demonstrate long-term ties/commitment (owner discretion).

---

## 9. Governance & Roles

### 8.1 Roles
- **Owner** (benevolent dictator): final say on Canon; appoints stewards; meta-policy veto.
- **Editors** (Canon): curate and shepherd; may promote threads to RFC.
- **Stewards** (Country Manuals): merge authority per-country; manage review norms.
- **Red Team members:** can file Findings; can promote candidate findings.
- **Contributors:** propose threads, nominate RFCs, submit RevSets if allowed.
- **Observers:** read, react, flag candidate findings.

### 8.2 Reputation for non-scorable contributions
Many domains (Canon argumentation, some realpolitik analysis, conceptual synthesis) are not directly scorable via claim resolution. Maintain a **separate reputation layer** that rewards demonstrated contribution quality without pretending to measure truth directly.

#### Reputation signals (examples)
- **Merged RFC contributions**: count/weight of RevSets that were merged (with weighting by impact and review rigor)
- **Peer review outcomes**: contributions that passed designated review windows (including red-team gates)
- **Endorsements**: endorsements from owner/stewards/editors and/or high-reputation users, optionally scoped by dossier
- **Review labor**: high-quality reviews, red-team mitigations, and adjudication work (tracked as first-class contributions)
- **Attribution quality**: citations, clarity, structured writing, and adherence to templates

#### Scope + transparency
- Reputation should be **scoped by dossier/topic** (expertise is local).
- Display reputation with provenance: which merges, which reviews, which endorsements.
- Keep it advisory; owner/stewards retain discretion.

### 8.3 Charter / Ground Rules (hard gate)
A site-wide Charter defines non-negotiable premises and scope constraints for Canon and Manuals.

Notes:
- Canon excludes divine authority as an epistemic premise for governance design.
- Manuals may treat religion as a political force/institution but not as epistemic authority.

(Exact Charter wording TBD as a separate artifact.)
 (hard gate)
A site-wide Charter defines non-negotiable premises and scope constraints for Canon and Manuals.

Notes:
- Canon excludes divine authority as an epistemic premise for governance design.
- Manuals may treat religion as a political force/institution but not as epistemic authority.

(Exact Charter wording TBD as a separate artifact.)

---

## 9. Requirements Matrix (Canon → Manuals linkage)

A Canon **Requirements Matrix** provides rows that manuals reference:
- requirement name
- definition
- metrics/tests
- typical interventions
- failure modes

Manual alignment artifacts link to one or more rows.

---

## 10. Open Design Questions (next RFC candidates)
- Exact dossier taxonomy and navigation tree
- Claim resolution authority model (global adjudicators vs per-country)
- Baseline forecasters per claim category
- Anti-gaming policies for scoring and leaderboards
- Charter wording and scope boundaries
- Moderator tools and audit logs

---

## Appendix A — Minimal Data Model (sketch)

### Entities
- Dossier { id, kind (canon|country), title, tags, roles }
- Artifact { id, dossier_id, type, title, content, version_history }
- Thread { id, dossier_id, state, is_rfc, is_redteam, targets[] }
- RevSet { id, thread_id, version, patch_payload, author, timestamp }
- Claim { id, artifact_id, type, text, p, as_of/deadline, criteria, sources, status }
- Finding { id, thread_id, target_ids[], severity, likelihood, evidence, status }
- AcceptedRisk { id, target_id, rationale, triggers, signer, timestamp }

---

## Appendix B — UI Outline (sketch)

- Dossier page:
  - overview + key artifacts
  - subforum tabs: Threads | RFCs | Red Team | Dashboard
  - dashboard: claim resolution stats + calibration + skill

- Thread page:
  - header (targets, tags, status)
  - filters (Findings only / Findings+Responses / All)
  - timeline
  - sidebar (optional): Findings index + candidate queue (for RT)

---

## Appendix C — Supported syntaxes and block types (MVP)

### Native (first-class, rendered)
- **Markdown**: standard Plate blocks (paragraph, heading, list, table, quote, code)
- **LaTeX Math**: `math_inline`, `math_block`
- **Mermaid**: `mermaid_block` (rendered diagrams)
- **Procedure / Pseudocode**: `procedure_block`
  - **Initial standard**: compatible with **pseudocode.js** input conventions (LaTeX-style pseudocode)
  - **Evolution plan**: gradually add lint rules and optional structured fields (roles, require/ensure, invariants) while maintaining backwards compatibility.

### Platform-lite (optional; highlight only)
- `code_block(language=...)` for **JSON / YAML / TOML / CSV** (no execution)

### External-by-reference (preferred for heavy languages)
- `external_artifact` block for programming languages, formal verification, optimization toolchains, large datasets.

---

## Appendix D — External artifact reference policy (whitelist + immutability)

### D.1 Goals
- Ensure references are durable, auditable, and de-duplicable.
- Prevent link-rot and mutable references masquerading as immutable.
- Enable automated grouping of references by **general identity** even when specific snapshots differ.

### D.2 Required fields for an external artifact reference
Each `external_artifact` must store both:
- **General reference** (stable identity): a canonical ID for the work/repo/project.
- **Specific reference** (immutable snapshot): commit hash / tag+checksum / DOI version / arXiv version.

Example fields:
- `provider` (github | zenodo | arxiv | osf | overleaf | etc.)
- `general_id` (e.g., repo canonical URL, DOI base, arXiv id)
- `specific_id` (e.g., commit SHA, DOI version, arXiv vN)
- `display_title`
- `summary`
- `license` (optional)

### D.3 Whitelist policy
Maintain an allowlist of providers with strict URL patterns:
- **GitHub (immutable)**: only URLs that include a **commit SHA** (e.g., `.../blob/<SHA>/path` or `.../tree/<SHA>`)
- **GitHub (general)**: repo root without commit for the general ID
- **Zenodo**: DOI (general) + DOI version (specific)
- **arXiv**: arXiv ID (general) + versioned ID `vN` (specific)
- **OSF**: project ID (general) + versioned file or timestamped snapshot (specific) where possible

If a provider cannot guarantee immutability for a specific reference, mark the snapshot as **non-immutable** and disallow it for “specific reference” use-cases.

### D.4 Validation rules
- Reject references that do not provide both general and specific forms.
- Normalize both IDs into canonical forms for deduplication.
- Store parsed components (owner/repo/SHA/path, DOI prefix/suffix, arXiv id/version) to support search and grouping.
