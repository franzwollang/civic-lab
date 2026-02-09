import { Header } from "../components/header";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Link } from "react-router";

export function Constitution() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-[1100px] px-8 py-12">
        <section className="mb-10">
          <Badge className="bg-neutral-100 text-neutral-700" variant="secondary">
            Constitution
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold text-neutral-900">
            Civic Lab Constitution
          </h1>
          <p className="mt-3 text-lg text-neutral-700">
            Foundational commitments, epistemic standards, and governance model.
          </p>
          <div className="mt-4 text-sm text-neutral-600">
            <div>
              <strong>Status:</strong> Founding text (fixed draft).
            </div>
            <div className="mt-1">
              <strong>Purpose:</strong> Make the platform’s priors, constraints,
              and authority structure explicit so contributors understand what
              they are joining—and what they are not joining.
            </div>
          </div>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              1) What Civic Lab Is
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              Civic Lab is a curated forum/wiki hybrid for building living,
              revisioned governance specifications and country-specific execution
              manuals.
            </p>
            <p className="mt-3 text-sm text-neutral-600">
              It has two primary channels:
            </p>
            <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-neutral-600">
              <li>
                Canon (Ideal / Spec): a coherent ideal framework for political,
                economic, voting, and cultural institutions—expressed as
                assumptions, constraints, invariants, mechanisms, tests, and
                failure modes.
              </li>
              <li>
                Country Manuals (Execution): pragmatic, country-specific field
                guides and incremental plans that model incentives, power
                dynamics, and feasibility while tracking alignment impacts
                relative to the Canon.
              </li>
            </ol>
            <p className="mt-3 text-sm text-neutral-600">
              Civic Lab exists to support high-signal synthesis and iteration with
              transparent uncertainty, while maintaining an auditable trail of
              contributions, disagreements, and decisions.
            </p>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              2) Core Foundational Assumptions
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.1 Humans are not utility maximizers
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Humans are not stable expected-utility agents. Behavior is shaped
                by bounded rationality, heuristics, satisficing, identity, status,
                coalition dynamics, social belonging, sacred values, moral
                emotions, fear, resentment, pride, shame, aspiration, narrative
                coherence, and myth-making.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.2 Institutions are adversarial systems
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Institutions must be designed under the assumption of conflict of
                interest, opportunism, rent-seeking, principal–agent failures,
                capture attempts, policy gaming, coordination failures, and
                perverse incentives. Systems that require “good people” to
                function are fragile. Robust systems remain stable under ordinary
                incentives.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.3 Legitimacy and culture are causal forces
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Legitimacy is not decoration. It shapes compliance, stability,
                and state capacity. Culture and norms are causal variables,
                especially when entwined with identity and moral meaning.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.4 Emotions and narratives are causal forces
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Narratives coordinate groups and constrain behavior. Emotions are
                not mere “irrational bugs”; they are part of the mechanism.
                Governance designs that ignore narrative and emotional dynamics
                are incomplete.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.5 Religion is a human construct
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Religions are human cultural systems—social technologies for
                identity, cohesion, moral framing, and power. They are treated
                here as historical and psychological phenomena, not divine
                revelation. Contributions premised on supernatural claims as
                authoritative ground truth are out of scope.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.6 Moral language is a tool, not proof
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Civic Lab treats moral language as psychologically and socially
                operative rather than intrinsically truth-bearing. Moralized
                phrasing can motivate, coordinate, and enforce norms. It can also
                function as status signaling, coalition marking, and rhetorical
                force. Therefore, moral intensity is not treated as evidence of
                correctness.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                This platform favors mechanism explanations and operational
                definitions over moral high-ground argumentation. Moral claims
                are allowed, but they must be translated into constraints,
                trade-offs, and predicted effects.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.7 Humanism is a goal, not a shortcut
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Civic Lab may adopt explicitly humanistic aims (e.g., human
                freedom and flourishing). However, humanistic intent is not
                accepted as sufficient justification for designs or claims. Many
                forms of freedom are constructed properties—enabled by
                institutions, enforcement, norms, and infrastructure. Freedom is
                often an amalgam of negative constraints removed rather than a
                single positive scalar.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                Therefore, “more freedom” must be specified operationally: for
                whom, from what, by what mechanism, at what cost, under what
                failure modes.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.8 Flourishing requires explicit models and bounded aggregation
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                “Flourishing” is difficult to aggregate and contestable. Pure
                global utilitarianism is rarely workable as an operational guide.
                Civic Lab therefore encourages explicit welfare models and
                indicators (plural, not singular), bounded and local notions of
                utility rather than a single global scalar, and explicit
                conflict-handling between kernels (trade-offs, constraints,
                reciprocity, stability).
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.9 No cosmic guarantees are required
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Civic Lab does not require metaphysical moral certainty. It is
                enough that humans have evolved wants and aversions, groups
                coordinate around shared constraints, and people prefer states of
                the world that reduce suffering and increase agency. Meaning may
                be constructed, not bestowed. That does not reduce the
                seriousness of the project; it clarifies it.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                2.10 Moral Standing and Citizenship (Substrate-Neutral, Operational)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Civic Lab recognizes that citizenship and moral standing are
                governance primitives that may apply beyond humans over time
                (e.g., advanced AI systems, bio-engineered entities, or other
                sentient life). The threshold for sentience is treated here as
                purely operational: standing is determined by observable,
                behaviorally and structurally grounded criteria rather than by
                metaphysical claims or biological origin. Accordingly, Civic Lab
                adopts a substrate-neutral intent.
              </p>

              <div className="mt-6">
                <h4 className="text-base font-semibold text-neutral-900">
                  2.10.1 Standing is distinct from platform power
                </h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Moral standing is not the same as editorial authority, merge
                  rights, or operational control. Acknowledging an entity’s
                  standing implies ethical constraints on how it may be treated
                  within the ecosystem; it does not automatically confer
                  governance privileges.
                </p>
              </div>

              <div className="mt-6">
                <h4 className="text-base font-semibold text-neutral-900">
                  2.10.2 Provisional tier model (subject to refinement)
                </h4>
                <p className="mt-2 text-sm text-neutral-600">
                  To avoid brittle binary debates (“sentient vs not”), Civic Lab
                  uses provisional tiers of standing. These tiers are intended to
                  evolve into a broader, operational framework of graded
                  citizenship—useful even for human governance design (e.g.,
                  distinctions analogous to protected classes such as children,
                  limited-standing dependents such as certain animals, and full
                  adults).
                </p>
                <p className="mt-3 text-sm text-neutral-600">
                  Initial tiers (working draft):
                </p>
                <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                  <li>
                    Tool / Non-sentient system: no moral standing is claimed;
                    treated as an instrument.
                  </li>
                  <li>
                    Candidate entity: insufficient confidence for standing, but
                    triggers caution norms and review when high-stakes treatment
                    is involved.
                  </li>
                  <li>
                    Protected entity (limited standing): afforded basic
                    protections (e.g., constraints against unnecessary harm,
                    coercive experimentation, or arbitrary destructive treatment
                    without review).
                  </li>
                  <li>
                    Citizen (full standing): treated as a first-class moral
                    patient within the ecosystem, with protections and procedural
                    recognition consistent with Civic Lab’s ethical commitments.
                  </li>
                </ul>
              </div>

              <div className="mt-6">
                <h4 className="text-base font-semibold text-neutral-900">
                  2.10.3 Owner commitment and review discipline
                </h4>
                <p className="mt-2 text-sm text-neutral-600">
                  The owner commits to good-faith development of operational
                  criteria for moral standing and tier assignment, informed by
                  relevant disciplines (machine learning, cognitive science,
                  philosophy of mind, law/ethics, and security). Determinations
                  should be documented with rationale and are expected to evolve
                  under critique and evidence.
                </p>
              </div>

              <div className="mt-6">
                <h4 className="text-base font-semibold text-neutral-900">
                  2.10.4 Humans as sentient by fiat (pragmatic safeguard)
                </h4>
                <p className="mt-2 text-sm text-neutral-600">
                  All humans are treated as sentient and as moral patients by
                  fiat, regardless of any future operational criteria or
                  edge-case disputes. This is a necessary pragmatic constraint
                  to prevent dehumanization, political abuse, and destabilizing
                  attempts to weaponize uncertainty about consciousness.
                </p>
                <p className="mt-3 text-sm text-neutral-600">
                  This stance does not prohibit scientific inquiry into cognition
                  or consciousness; it prohibits using such inquiry to deny basic
                  standing to humans.
                </p>
              </div>

              <p className="mt-6 text-sm text-neutral-500">
                Note (placeholder): This standing framework is expected to expand
                into its own dedicated design artifacts (definitions, criteria,
                edge cases, and adversarial review) as the platform matures.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              3) Epistemic Commitments
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.1 Explicit uncertainty
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                All substantive claims should indicate uncertainty when
                appropriate: confidence level or probability, conditions and
                caveats, and what evidence would change the claim.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.2 Preference for resolvable claims
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                When possible, descriptive statements should be formulated to be
                resolvable: criteria for being true/false, time window for
                resolution, and references to acceptable sources. Vague language
                must be tied to measurable thresholds and time windows or moved
                into explicitly labeled speculative content.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.3 Constructs must earn their meaning (nomological networks)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Constructs and abstractions are not treated as valid because they
                are rhetorically compelling. A construct earns meaning through its
                role in a network of constraints: it predicts, is predicted by,
                explains, and is explained by other constructs across contexts
                without special pleading. Definitions are provisional; the web of
                implications gives them bite.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.4 Holistic pressure and continuity (falsification with
                constraint inheritance)
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Civic Lab acknowledges that tests hit bundles of assumptions, not
                isolated statements. Disconfirmation therefore creates pressure on
                the overall theory bundle. Continuity is preserved through
                constraint inheritance: revised theories should retain the
                boundary conditions implied by previous falsifications,
                preserving structure where possible while changing the minimal
                substructure required to satisfy the newest constraints.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                Observations carve away theory-space. We preserve momentum by
                inheriting constraints, not by denying disconfirmation.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.5 No ad hoc immunization without cost accounting
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                If auxiliary assumptions are adjusted to preserve a core claim,
                the modification must state its cost (reduced generality, narrower
                scope, increased complexity, loss of predictive sharpness, or new
                tensions with other constraints). Patches are allowed. Unpriced
                patches are not.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.6 Evidence is contextual
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Different domains require different evidence standards. Civic Lab
                encourages primary sources where feasible, but does not assume one
                universal evidence hierarchy fits all questions.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.7 Adversarial review is healthy
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                High-quality critique is a first-class contribution. Dissent is
                expected, documented, and preserved.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                3.8 Canonical language, auditability, and local term aliasing
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Civic Lab’s canonical working language is English across all
                artifacts, discussions, and change-control workflows, including
                Country Manuals. This is a pragmatic constraint chosen to
                maximize global auditability, cross-country transparency, and
                consistent review by global roles (Red Team, adjudicators,
                stewards). This choice is not a claim of cultural preference or
                superiority; it is an operational standard to reduce
                fragmentation, translation disputes, and closed-language capture.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                Non-English material is welcome as source evidence and may be
                quoted. When non-English sources are used to support claims, they
                must be accompanied by an English translation or paraphrase
                sufficient for review.
              </p>

              <div className="mt-6">
                <h4 className="text-base font-semibold text-neutral-900">
                  Local term aliasing (sketch)
                </h4>
                <p className="mt-2 text-sm text-neutral-600">
                  Civic Lab expects that many country-specific concepts do not
                  translate cleanly into English. To preserve nuance without
                  fragmenting the corpus into multiple languages, Civic Lab
                  intends to support a glossary and aliasing mechanism (to be
                  formalized later).
                </p>
                <p className="mt-3 text-sm text-neutral-600">
                  Dossiers and artifacts may declare local terms (native-language
                  words or phrases, legal terms, institutional names, slang, and
                  idioms) and bind them to an English canonical label used
                  throughout the platform.
                </p>
                <p className="mt-3 text-sm text-neutral-600">
                  The binding may include:
                </p>
                <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                  <li>The original term(s) in the local language.</li>
                  <li>Transliteration(s), alternate spellings, and abbreviations.</li>
                  <li>A short operational definition (what it refers to in practice).</li>
                  <li>Near matches and not-the-same-as distinctions.</li>
                </ul>
                <p className="mt-3 text-sm text-neutral-600">
                  These alias bindings are intended to function as stable
                  reference points for cross-linking and search, consistent
                  naming in claims and RFCs, and a way to preserve local nuance
                  while remaining globally reviewable in English.
                </p>
                <p className="mt-3 text-sm text-neutral-500">
                  Note (placeholder): This mechanism is a sketch. The data model,
                  moderation rules, and conflict resolution (e.g., competing
                  translations or definitions) will be defined in dedicated
                  artifacts and reviewed through the platform’s change-control
                  process.
                </p>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              4) Separation of Lanes in Country Manuals
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              To keep reasoning legible, Civic Lab separates manual content into
              lanes. Each artifact must have exactly one primary lane.
            </p>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                4.1 Descriptive lane
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                What is true now (or forecasted), with sources, confidence, and
                resolution criteria when possible.
              </p>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                4.2 Prescriptive lane
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Plans and actions to achieve an explicit objective. The actor and
                objective must be stated.
              </p>
            </div>
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                4.3 Alignment lane
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Steps that move a country toward Canon invariants and constraints,
                with an explicit alignment impact assessment and risk disclosure.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              5) Realism Without Pretense
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              Civic Lab permits realistic institutional analysis, including
              objective-driven realpolitik reasoning in Country Manuals. This is
              allowed because it is necessary to model the world as it is.
            </p>
            <p className="mt-3 text-sm text-neutral-600">However:</p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>
                Such reasoning must be intellectually honest about side-effects,
                blowback, reversibility, and confidence.
              </li>
              <li>Moral grandstanding is not treated as evidence.</li>
              <li>The platform is not a venue for operational instructions for wrongdoing.</li>
            </ul>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              6) Governance Model
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                6.1 Provisional and evolving
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Civic Lab is an early-stage project. Its governance, funding
                model, and institutional form are tentative and will evolve as
                the platform matures, participation increases, and operational
                realities become clearer.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                The owner commits to making governance changes explicit,
                documented, and reviewable, with a preference for stable
                processes over ad hoc discretion as soon as that becomes
                operationally viable.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                6.2 Benevolent dictator model for the Canon
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                The Canon has final editorial oversight by the platform owner.
                The owner may veto merges into the Canon.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                When the owner vetoes a Canon change, the decision should be
                accompanied by an Opinion artifact that states the decision,
                steelmans the strongest opposing arguments, explains the
                rationale, and specifies what evidence would change the decision.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                This is intended to keep veto power transparent and accountable,
                rather than arbitrary.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                6.3 Delegated stewardship for Country Manuals
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Country Manuals may have appointed stewards with merge authority
                within their scope, subject to platform-wide rules and oversight.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                Stewardship is meant to scale high-quality execution work without
                requiring the owner to personally shepherd every dossier.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                6.4 Global Red Team and global adjudication
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                To reduce local ideological bubbles and capture, Red Team members
                and adjudicators are global roles, independent of country
                stewards.
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Red Team issues Findings and critiques; it does not merge content.</li>
                <li>Adjudicators resolve claim disputes; they do not merge content.</li>
                <li>
                  Stewards/owner merge content; they cannot suppress Red Team
                  findings or override adjudication outcomes without transparent
                  signoff.
                </li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                6.5 Funding and institutional independence
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                As interest and participation increase, the owner is committed to
                raising funds to support operations through mechanisms such as
                direct donations, patronage (e.g., membership/support platforms),
                and other transparent, mission-compatible funding sources.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                The goal is to support infrastructure, moderation, and
                administrative overhead without dependency on any single
                political faction, sponsor, or institutional gatekeeper.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                6.6 Non-profit formation and jurisdiction intent
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                When operationally viable, the owner intends to form a non-profit
                entity to increase the platform’s durability, credibility, and
                autonomy.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                To maximize institutional independence and preserve a wide scope
                for discussion (including frank realpolitik analysis), the owner
                currently believes Canada is the best compromise jurisdiction:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>The United States is viewed as comparatively volatile in its regulatory and political swings.</li>
                <li>The European Union is viewed as sometimes overly paternalistic in attempts to preempt harms.</li>
              </ul>
              <p className="mt-3 text-sm text-neutral-600">
                This is an intent statement, not a final legal commitment. The
                platform may revise this plan as circumstances and feasibility
                become clearer.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                6.7 Governance evolution and amendment discipline
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Changes to governance and institutional form should be treated as
                high-impact amendments: proposed openly, documented with
                rationale and trade-offs, subject to structured critique
                (including Red Team review when appropriate), and recorded
                permanently for auditability.
              </p>
              <p className="mt-3 text-sm text-neutral-600">
                Until the platform’s artifact system is fully operational,
                governance updates are manual and owner-controlled, with a
                commitment to preserve transparency and decision provenance.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              7) Accountability and Identity
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                7.1 Real-person policy
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Contributors with write access are verified as real people. Public
                pseudonymity may be allowed, but internal accountability is
                required.
              </p>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                7.2 Provenance is permanent
              </h3>
              <p className="mt-2 text-sm text-neutral-600">
                Contributions, decisions, and dissent records are preserved with
                attribution. Civic Lab prefers durable accountability over
                ephemeral discourse.
              </p>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              8) Scope and Boundaries
            </h2>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                8.1 Civic Lab welcomes
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Rigorous synthesis and model exploration with explicit uncertainty.</li>
                <li>Comparative institutional design.</li>
                <li>Mechanism design and incentive analysis.</li>
                <li>Empirical case studies and historical grounding.</li>
                <li>Structured critique (red team) and improvements (RFCs).</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold text-neutral-900">
                8.2 Civic Lab rejects
              </h3>
              <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                <li>Content premised on supernatural revelation as authoritative ground truth.</li>
                <li>Vague rhetoric substituting for criteria and evidence.</li>
                <li>Moral grandstanding as a substitute for mechanisms, definitions, or evidence.</li>
                <li>Harassment, doxxing, or identity-based incitement.</li>
                <li>Operational instructions for wrongdoing.</li>
              </ul>
            </div>
          </Card>
        </section>

        <section className="mb-10">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              9) Amendments
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              This constitution may evolve. Any amendment should state the change
              and rationale, specify intended effects and trade-offs, include an
              explicit dissent/critique section, and be reviewed through the
              platform’s change control process. Until the platform’s artifact
              system is fully operational, amendments are manual and owner-controlled.
            </p>
          </Card>
        </section>

        <section>
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              10) The Spirit of the Project
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              Civic Lab is a place for people who want to think clearly, argue
              honestly, and build durable structure—not to win attention or
              perform identity games.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
              <li>Make disagreements legible rather than endless.</li>
              <li>Keep uncertainty explicit rather than hidden.</li>
              <li>Preserve dissent rather than memory-holed.</li>
              <li>Build systems that work under real incentives, not idealized citizens.</li>
            </ul>
            <p className="mt-4 text-sm font-semibold text-neutral-900">
              If these commitments are unacceptable to you, Civic Lab is not for you.
            </p>
            <div className="mt-6 text-sm text-neutral-600">
              Prefer a shorter overview? Read the
              <Link
                to="/about"
                className="ml-1 text-neutral-900 hover:text-neutral-700"
              >
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
