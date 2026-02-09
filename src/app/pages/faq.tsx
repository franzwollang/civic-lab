import { Header } from "../components/header";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Link } from "react-router";

export function Faq() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-[1100px] px-8 py-12">
        <section className="mb-10">
          <Badge className="bg-neutral-100 text-neutral-700" variant="secondary">
            Civic Lab FAQ
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold text-neutral-900">
            Civic Lab FAQ
          </h1>
          <p className="mt-3 text-lg text-neutral-700">
            Living, revisioned governance specs with structured review, adversarial
            testing, and transparent uncertainty.
          </p>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              What is Civic Lab?
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              Civic Lab is a forum/wiki hybrid for building living, revisioned
              governance specs—and the country-specific manuals required to move
              real societies toward better outcomes. It’s designed like an
              engineering lab: explicit assumptions, structured review,
              adversarial testing (red team), and transparent uncertainty.
            </p>
          </Card>
        </section>

        <section className="mb-10" id="do-i-need-math">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Do I need math or CS to use Civic Lab?
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              No. Civic Lab is written to be readable without technical
              background. Technical terms, math, and formal models show up
              because they reduce ambiguity and make arguments auditable—but
              they’re optional precision tools, not a prerequisite.
            </p>
            <p className="mt-3 text-sm text-neutral-600">
              Practical rule: read the plain-language summary first. Only dive
              into formal sections when you want to check definitions, test
              claims, or resolve a disagreement precisely.
            </p>
          </Card>
        </section>

        <section className="mb-10" id="why-technical">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Why does Civic Lab use technical language?
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              Because governance debates are often argument-shaped, not
              evidence-shaped. Technical motifs (models, definitions, invariants,
              tests, failure modes, metrics) help compress complexity and make
              “what would change my mind” explicit.
            </p>
            <p className="mt-3 text-sm text-neutral-600">
              The intent is clarity, not gatekeeping.
            </p>
          </Card>
        </section>

        <section className="mb-10" id="unfamiliar-terms">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              What if I hit unfamiliar terms or notation?
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>Skip the formal block and keep reading the summary.</li>
              <li>Ask for a plain-language rewrite.</li>
              <li>
                If it’s a descriptive claim, ask for it to be rewritten as a
                resolvable claim with definitions, thresholds, and time windows.
              </li>
            </ul>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              What is Civic Lab not?
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>Not a neutral public square</li>
              <li>Not a social media debate arena</li>
              <li>Not a journal</li>
              <li>Not a political party, lobbying group, or persuasion campaign</li>
              <li>Not a place for operational “how-to” wrongdoing</li>
            </ul>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              What’s the core value proposition?
            </h2>
            <p className="mt-3 text-sm text-neutral-600">A place where:</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>Broad synthesis is allowed (with uncertainty made explicit).</li>
              <li>“Truth contact” is enforced via claims/tests where possible.</li>
              <li>Dissent is preserved as durable structure (red team).</li>
              <li>Changes are reviewed via RFC workflows, not comment wars.</li>
            </ul>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Mission and Philosophy
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What are you optimizing for: truth, persuasion, or execution?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Truth is primary. Execution is supported through Country Manuals.
                Persuasion is assumed to happen outside the platform via
                third-party groups.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Why does “truth-first” matter if politics is messy?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Because you can still:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Model incentives and failure modes.</li>
                <li>Score forecasts in descriptive lanes.</li>
                <li>Define invariants and constraints.</li>
                <li>Track uncertainty explicitly.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Even when values differ, clarity about mechanisms reduces noise.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What’s the “two-stage pipeline” idea?
              </h3>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-600">
                <li>
                  Exploration and synthesis: coherent, model-driven extensions are
                  allowed even if partially validated—uncertainty is explicit.
                </li>
                <li>
                  Consolidation: mature work is distilled into narrower falsifiable
                  claims, publishable units, or actionable steps.
                </li>
              </ol>
              <p className="mt-3 text-sm text-neutral-600">
                This is analogous to branch expansion and pruning in search:
                explore candidate frameworks, then tighten.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10" id="two-channels">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Structure: Canon vs Country Manuals
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What are the two main channels?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Canon (Ideal): The spec—principles, invariants, mechanisms, tests,
                failure modes.
              </p>
              <p className="mt-2 text-sm text-neutral-600">
                Country Manuals (Execution + realpolitik): Country-specific manuals
                with current constraints, stepwise plans, descriptive intelligence,
                and strategic objectives.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Is the Canon one universal optimum?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Yes—one coherent Canon, supported by multiple models that admit
                adaptation under explicit assumptions.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                How do you prevent Canon from becoming ideology or dogma?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">By forcing:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Explicit assumptions and invariants.</li>
                <li>Clear “what evidence would change this” notes.</li>
                <li>Structured red-team cases.</li>
                <li>Durable dissent records even when changes are vetoed.</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is the role of realpolitik?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Manuals can include objective-driven, amoral institutional strategy
                analysis. Canon can remain deeply normative/humanistic. The
                platform separates these concerns to preserve clarity.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10" id="objects">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Core Collaboration Objects
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is a Dossier?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                A Dossier is the primary semantic container. It groups artifacts
                (documents), threads (subforum), RFCs (change proposals), red-team
                cases/findings, and dashboards/metrics.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is an Artifact?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                A structured wiki-style document inside a dossier: Canon specs,
                Country manual chapters, case studies, procedures, and
                definitions/glossaries. Artifacts are revisioned and attributable.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Why threads-first instead of per-page comments?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Because:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Most discussion does not become changes.</li>
                <li>Per-page comments fragment context.</li>
                <li>Meaningful debate often spans multiple related artifacts.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Threads are the primary unit. They can later become RFCs if
                needed.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10" id="rfcs">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              RFCs: Change Control
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is an RFC?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                A Request for Change is a structured proposal thread: it has scope
                and acceptance criteria, contains revision sets (RevSets),
                produces a merge/reject/park decision, and leaves an auditable
                trail.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Why not just allow direct wiki edits?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                The goal is to avoid lowest common denominator drift. RFCs
                concentrate negotiation in one place, preserve provenance, and
                support higher standards and accountability.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is a Revision Set?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                A RevSet is a bundled patch proposal within an RFC. Authors can
                iteratively update RevSets until the RFC is decided.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What qualifies as a high impact RFC?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Examples:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Changes to Canon invariants/definitions.</li>
                <li>Changes that alter scoring/resolution policies.</li>
                <li>Major alterations to a country manual strategy track.</li>
                <li>Changes that materially alter institutional procedures.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                High-impact RFCs trigger stronger red-team expectations.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10" id="red-team">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Red Team: Structured Dissent
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What are Red Team cases?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Red Team cases are first-class adversarial review processes that
                produce structured Findings. A finding is a durable record of a
                counterexample, exploit path, failure mode, missing constraint,
                bad assumption, or contradictory evidence.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                How is Red Team different from normal critique?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Red Team has:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Structured findings (not just comments).</li>
                <li>Statuses (open/mitigated/accepted-risk).</li>
                <li>Gating power on high-impact merges.</li>
                <li>A persistent, searchable adversarial record.</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Who can file Findings?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Only Red Team members file formal findings. Others can comment,
                flag candidate findings, propose evidence, and request RT review.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                How do candidate findings work?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Observers can flag messages. Red Team members can promote flagged
                messages into formal findings if they meet quality standards.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is the “Supreme Court opinion” concept?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                When the owner vetoes a Canon change, the decision should produce
                an Opinion artifact: the decision, the strongest counterarguments
                (steelman), the rationale, and what evidence would change the
                decision. This ensures veto power is transparent, not arbitrary.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Claims, Forecasting, and Metrics
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is a claim on Civic Lab?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                A claim is a resolvable statement in the descriptive lane: a
                time-stamped fact with confidence, a probabilistic forecast with
                deadline and criteria, or a model claim tied to forecast
                implications. Each claim includes resolution criteria, preferred
                sources, confidence/probability, and a defined time horizon.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What do you mean by forcing claims to be resolvable?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                You ban vague rhetoric unless it’s rewritten with metric
                thresholds, time windows, and explicit criteria for what would
                count as true/false.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                Example: Bad: “Corruption is increasing.” Good: “CPI rank worsens
                by ≥10 places between 2026–2028.”
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is the difference between claim quality and forecast accuracy
                metrics?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Claim quality metrics are about process hygiene and legibility:
                invalidated rate, ambiguity rate, time-to-resolution, citation
                density, and optional specificity scores. Forecast accuracy
                metrics measure truth calibration: log score, Brier score,
                calibration curves, sharpness, and skill vs baseline.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Can scoring be gamed?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Yes. Any single metric can be gamed, which is why Civic Lab tracks
                a bundle and treats scores as signals, not permission gates.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Will scores automatically grant privileges?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                No. Privileges are discretionary, but scores create transparency
                and accountability.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What about areas where scoring doesn’t apply?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Use reputation and provenance: merged RFC contributions, red-team
                gates passed, endorsements scoped by dossier/topic, review labor
                and adjudication support, and quality of critique and clarity.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10" id="governance-roles">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Governance and Roles
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Who runs the platform?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                A benevolent dictator model: owner has final veto on Canon,
                stewards can govern country manuals, and red-team/adjudicators are
                global independent roles.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Why global Red Team and adjudicators?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                To prevent localized bubbles and ideological capture. Country
                stewards cannot silence global red-team findings or override
                adjudications.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What is the separation of powers?
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Stewards/owner merge content.</li>
                <li>Adjudicators resolve claim disputes.</li>
                <li>Red Team issues findings.</li>
                <li>Adjudicators do not merge; Red Team does not merge.</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Identity policy: are accounts pseudonymous?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Publicly pseudonymous is allowed. Internally, contributors are
                real-ID verified.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Content Hygiene: Manual Lanes and Realpolitik
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What are the manual lanes?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Each manual artifact has exactly one primary lane: Descriptive
                (what is true now + forecasts), Prescriptive (plans to achieve an
                objective with explicit actors), and Alignment (steps moving
                toward Canon invariants).
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Why separate lanes?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">To avoid conflating:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Evidence vs advocacy.</li>
                <li>Prediction vs aspiration.</li>
                <li>Alignment vs power politics.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Lane separation keeps documents legible and reviewable.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                How do you keep realpolitik from becoming a cookbook for harm?
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Stay at institutional/state level.</li>
                <li>Require explicit side-effects and blowback fields.</li>
                <li>Avoid operational step-by-step instructions for wrongdoing.</li>
                <li>
                  Prefer analysis, constraints, and risk disclosure over tactical
                  guidance.
                </li>
              </ul>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Document Editing and Syntax Support
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                What document syntaxes are supported natively?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Core:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Markdown-style content (headings, lists, tables).</li>
                <li>LaTeX math (inline + block).</li>
                <li>Mermaid diagrams.</li>
                <li>Procedure blocks (pseudocode.js syntax).</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Optional highlight-only snippets: JSON, YAML, TOML, CSV.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Why have structured snippets if you’re not a programming platform?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Because governance design needs precise card-like objects:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Claim templates.</li>
                <li>Strategy action templates.</li>
                <li>Risk matrices.</li>
                <li>Small evidence datasets.</li>
                <li>Taxonomy definitions.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Highlight-only support makes these copyable and unambiguous
                without turning the site into an IDE.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Publications and External Outputs
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Is publication an explicit goal?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Publication is a supported outcome, not the primary goal. The
                platform is publication-compatible by design through immutable
                revision history, provenance and attribution logs, red-team
                appendices, and export bundles (later).
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Will there be tooling to help publish?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Potential supports:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Export an artifact/RFC bundle into Markdown/LaTeX + citations.</li>
                <li>Contribution log export.</li>
                <li>Authorship proposal workflow with dispute windows.</li>
                <li>Publication track labels with stricter hygiene.</li>
              </ul>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Community, Access, and Avoiding Reddit
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                How do you prevent the early community from poisoning the well?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">By launching as:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Read-only public.</li>
                <li>Gated write access.</li>
                <li>Structured workflows (RFCs, red-team).</li>
                <li>Minimal unstructured chat surfaces.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                The public face is the artifact library and the audit trail, not
                the chat stream.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Is manual ID verification scalable?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Not initially. Culture formation matters more than scale.
                Verification can be delegated or outsourced later.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900" id="participation-ladder">
                What is the participation ladder?
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                See the onboarding section below.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10" id="onboarding">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Onboarding
            </h2>
            <p className="mt-2 text-sm text-neutral-600">
              Civic Lab has two primary workflows: reading and mapping the
              landscape, and contributing through structured change. Pick your
              role below.
            </p>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Role 0: Reader (no account required)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Goal: understand the Canon and the manuals.
              </p>
              <p className="mt-3 text-sm text-neutral-600">What you can do:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Browse dossiers.</li>
                <li>Read artifacts.</li>
                <li>Read RFC history and red-team cases.</li>
                <li>Follow tags and topics.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Recommended first steps:
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-600">
                <li>Read “Constitution / Mission / Standards” dossier.</li>
                <li>Read one Canon dossier you care about.</li>
                <li>Read one Country Manual dossier you care about.</li>
                <li>
                  Skim a few RFC decisions and Red Team findings to understand
                  how disagreements are handled.
                </li>
              </ol>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Role 1: Observer (account; unverified)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Goal: ask good questions and flag issues without degrading signal
                quality.
              </p>
              <p className="mt-3 text-sm text-neutral-600">You can do:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Follow dossiers.</li>
                <li>Bookmark artifacts.</li>
                <li>
                  Open discussion threads in limited zones (optional, based on
                  policy).
                </li>
                <li>Flag candidate red-team findings (if enabled).</li>
                <li>Propose claim rewrites (in thread form).</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Your first contribution should be one of:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>A concrete correction with a citation.</li>
                <li>A resolvable claim rewrite (add threshold + time window).</li>
                <li>A candidate finding flag with evidence.</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Role 2: Verified Contributor (real-ID verified)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Goal: participate in dossier subforums, propose RFCs, and submit
                RevSets.
              </p>
              <p className="mt-3 text-sm text-neutral-600">You can do:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Open and participate in dossier threads.</li>
                <li>Promote threads into RFCs (or request promotion).</li>
                <li>Submit revision sets (patches).</li>
                <li>
                  Participate in red-team discussions (not file findings unless
                  RT).
                </li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">Expected standards:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Cite sources for descriptive claims.</li>
                <li>State uncertainty/confidence explicitly.</li>
                <li>Keep lane hygiene in manuals.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">Suggested starter tasks:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Fix one artifact for clarity + citations.</li>
                <li>Submit one small RFC with a clean RevSet.</li>
                <li>Convert vague statements into resolvable claims.</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Role 3: Steward (appointed)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Goal: maintain coherence and quality in a dossier or country
                manual.
              </p>
              <p className="mt-3 text-sm text-neutral-600">You can do:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Approve/merge RFCs in your scope.</li>
                <li>Enforce lane hygiene.</li>
                <li>Curate dossier structure and templates.</li>
                <li>Request red-team review for high-impact changes.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">Steward responsibilities:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Document decisions.</li>
                <li>Maintain minimal standards and civility.</li>
                <li>
                  Avoid local capture (global red-team/adjudicators can override
                  bubbles).
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Role 4: Red Team Member (global)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Goal: adversarially test claims, invariants, and high-impact
                proposals.
              </p>
              <p className="mt-3 text-sm text-neutral-600">You can do:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>File formal findings.</li>
                <li>Promote candidate findings.</li>
                <li>
                  Require mitigations or accepted-risk signoffs for high-impact
                  merges.
                </li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">What good looks like:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Precise counterexamples.</li>
                <li>Crisp failure modes.</li>
                <li>Evidence-backed critiques.</li>
                <li>Clear severity/likelihood judgments.</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                Role 5: Adjudicator (global)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Goal: resolve claim disputes when sources conflict or resolution
                criteria are contested.
              </p>
              <p className="mt-3 text-sm text-neutral-600">You can do:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Mark claims resolved/ambiguous/source-conflict/invalidated.</li>
                <li>Document adjudication rationale.</li>
                <li>Maintain resolution policy consistency.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">Constraints:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Adjudicators do not merge content (separation of powers).</li>
              </ul>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Contribution Playbooks
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                A) Open a Thread (good)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Use when you want to:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Ask a scoped question.</li>
                <li>Raise an objection.</li>
                <li>Suggest a small improvement.</li>
                <li>Request evidence.</li>
                <li>Propose a claim rewrite.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">Thread template:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Target artifact/section.</li>
                <li>What’s wrong or missing.</li>
                <li>Your proposed fix.</li>
                <li>Evidence/references.</li>
                <li>Confidence level.</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                B) Promote to RFC (when change is real)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Use when:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>You want to change Canon text.</li>
                <li>You want to restructure a manual.</li>
                <li>You want to update definitions/invariants.</li>
                <li>You’re proposing nontrivial edits.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">RFC template:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Scope.</li>
                <li>Acceptance criteria.</li>
                <li>Risk/side-effect notes.</li>
                <li>Revision set(s).</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                C) Flag Candidate Finding
              </h3>
              <p className="mt-2 text-sm text-neutral-600">Use when:</p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>You believe a serious flaw exists.</li>
                <li>You found contradictory evidence.</li>
                <li>You found an exploit/failure mode.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                Candidate finding template:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Claim/invariant targeted.</li>
                <li>Failure mode summary.</li>
                <li>Evidence.</li>
                <li>Severity + likelihood guess.</li>
              </ul>
            </div>
          </Card>
        </section>

        <section>
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              What should I do first?
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>If you’re evidence-minded: start in Descriptive lane claim cleanup.</li>
              <li>If you’re systems-minded: start in Canon invariants + tests.</li>
              <li>If you’re strategic: start in a Country Manual alignment steps.</li>
              <li>If you’re adversarial: start by flagging candidate red-team findings.</li>
            </ul>
            <div className="mt-6 text-sm text-neutral-600">
              Prefer the canonical overview? Read the
              <Link to="/about" className="ml-1 text-neutral-900 hover:text-neutral-700">
                About page
              </Link>
              .
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
