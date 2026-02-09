import { Header } from "../components/header";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  ArrowRight,
  BookOpen,
  MapPin,
  MessageSquare,
  GitPullRequest,
  ShieldCheck,
  Target,
  Scale,
} from "lucide-react";
import { Link } from "react-router";

export function About() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-[1200px] px-8 py-12">
        <section className="mb-12">
          <Badge className="bg-neutral-100 text-neutral-700" variant="secondary">
            About Civic Lab
          </Badge>
          <h1 className="mt-4 text-4xl font-semibold text-neutral-900">
            Civic Lab
          </h1>
          <p className="mt-3 text-lg text-neutral-700">
            A governance engineering lab: living specs, adversarial review, and
            transparent uncertainty.
          </p>
          <p className="mt-4 max-w-3xl text-neutral-600">
            Civic Lab is a forum/wiki hybrid for building high-quality, revisioned
            knowledge bases about political systems, economic systems, voting
            systems, cultural institutions, and the real-world plans needed to
            move societies toward better outcomes.
          </p>
          <div className="mt-6">
            <Link
              to="/faq"
              className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-700"
            >
              Read the FAQ
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/constitution"
              className="ml-6 inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-700"
            >
              Read the Constitution
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="mb-12" id="how-to-read">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="text-xl font-semibold text-neutral-900">
              How To Read Civic Lab
            </h2>
            <p className="mt-3 text-sm text-neutral-600">
              You’ll encounter math, science, and CS terms here. They’re not
              required—but they’re common because they make complex reasoning
              more legible and disagreements more auditable.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-neutral-600">
              <li>Start with the plain-language summary of an artifact or RFC.</li>
              <li>Use formal sections as optional precision tools when needed.</li>
              <li>
                If something is unclear, ask for a rewrite as a resolvable claim
                with definitions, thresholds, and time windows.
              </li>
            </ul>
            <div className="mt-auto flex flex-wrap gap-x-6 gap-y-2 pt-4 text-sm">
              <Link
                to="/faq#do-i-need-math"
                className="font-semibold text-neutral-900 hover:text-neutral-700"
              >
                FAQ: Do I need math/CS?
              </Link>
              <Link
                to="/faq#unfamiliar-terms"
                className="font-semibold text-neutral-900 hover:text-neutral-700"
              >
                FAQ: Unfamiliar terms
              </Link>
            </div>
          </Card>
        </section>

        <section className="mb-12 grid gap-6 lg:grid-cols-2" id="charter">
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">
              Not a Neutral Platform
            </h2>
            <p className="text-sm text-neutral-600">
              Civic Lab has an explicit constitution and a clear editor-in-chief
              model. The trade is simple: higher signal, stronger standards, and
              an auditable trail of reasoning.
            </p>
          </Card>
          <Card className="border border-neutral-200 bg-white p-6">
            <h2 className="mb-3 text-lg font-semibold text-neutral-900">
              A Living System
            </h2>
            <ul className="space-y-2 text-sm text-neutral-600">
              <li>Assumptions are explicit.</li>
              <li>Uncertainty is tracked, not hidden.</li>
              <li>Claims are tied to evidence where possible.</li>
            </ul>
          </Card>
        </section>

        <section className="mb-12" id="two-channels">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Two Channels
            </h2>
            <p className="mt-2 text-neutral-600">
              The platform separates ideals from execution so both can be held to
              rigorous, legible standards.
            </p>
            <div className="mt-3 text-sm">
              <Link
                to="/faq#two-channels"
                className="font-semibold text-neutral-900 hover:text-neutral-700"
              >
                FAQ: Canon vs Country Manuals
              </Link>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900">
                  <BookOpen className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Canon (Ideal)
                  </h3>
                  <Badge className="mt-1 bg-blue-50 text-blue-700">
                    Living Spec
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-neutral-600">
                The Canon is the spec. It defines a coherent ideal framework:
                core principles, constraints, invariants, and mechanisms—plus the
                tests, metrics, and failure modes that let us argue about it
                rigorously.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li>Assumptions are explicit.</li>
                <li>Uncertainty is tracked, not hidden.</li>
                <li>Claims are tied to evidence where possible.</li>
              </ul>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-900">
                  <MapPin className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Country Manuals (Execution)
                  </h3>
                  <Badge className="mt-1 bg-emerald-50 text-emerald-700">
                    Field Guides
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-neutral-600">
                Country Manuals are pragmatic field guides: current conditions,
                constraints, incentives, and stepwise plans. They are
                country-specific by design and include descriptive intelligence,
                prescriptive strategy, and alignment steps toward the Canon.
              </p>
              <p className="mt-4 text-sm text-neutral-600">
                This side is allowed to be bluntly realistic. It is also required
                to be intellectually honest.
              </p>
            </Card>
          </div>
        </section>

        <section className="mb-12" id="workflow">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              How Work Gets Done Here
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border border-neutral-200 bg-white p-6 h-full">
              <MessageSquare className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                Threads-first Collaboration
              </h3>
              <p className="text-sm text-neutral-600">
                Discussion happens in threads attached to larger semantic units
                (dossiers), not scattered comment sections.
              </p>
              <div className="mt-auto pt-4 text-sm">
                <Link
                  to="/faq#objects"
                  className="font-semibold text-neutral-900 hover:text-neutral-700"
                >
                  FAQ: Core collaboration objects
                </Link>
              </div>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6 h-full">
              <GitPullRequest className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                RFC Workflow (Change Control)
              </h3>
              <p className="text-sm text-neutral-600">
                When discussion becomes actionable, a thread can be promoted to
                an RFC (Request for Change). RFCs bundle revisions, diffs, and
                review into a single, auditable path from proposal to merge.
              </p>
              <div className="mt-auto pt-4 text-sm">
                <Link
                  to="/faq#rfcs"
                  className="font-semibold text-neutral-900 hover:text-neutral-700"
                >
                  FAQ: RFCs
                </Link>
              </div>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6 h-full">
              <ShieldCheck className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                Red Team Cases (First-class Dissent)
              </h3>
              <p className="text-sm text-neutral-600">
                Strong disagreement, skepticism, and deconstruction aren’t
                buried—they’re formalized. Red Team cases produce structured
                findings, mitigation discussions, and accepted-risk signoffs when
                needed.
              </p>
              <div className="mt-auto pt-4 text-sm">
                <Link
                  to="/faq#red-team"
                  className="font-semibold text-neutral-900 hover:text-neutral-700"
                >
                  FAQ: Red Team
                </Link>
              </div>
            </Card>
          </div>
        </section>

        <section className="mb-12" id="standards">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Standards and Uncertainty
            </h2>
            <p className="mt-2 text-neutral-600">
              We push hard for measurability when possible, and for clarity when
              direct measurement isn’t available.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-neutral-200 bg-white p-6 h-full">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <Target className="h-4 w-4" />
                Where Reality Is Measurable
              </div>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li>Descriptive claims are written to be resolvable now or later.</li>
                <li>Claims can include explicit confidence.</li>
                <li>The platform tracks claim quality and forecast calibration.</li>
              </ul>
              <div className="mt-auto pt-4 text-sm">
                <Link
                  to="/faq#why-technical"
                  className="font-semibold text-neutral-900 hover:text-neutral-700"
                >
                  FAQ: Why the technical language?
                </Link>
              </div>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6 h-full">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <Scale className="h-4 w-4" />
                Where Reality Is Not Directly Measurable
              </div>
              <ul className="space-y-2 text-sm text-neutral-600">
                <li>Assumptions, definitions, and tradeoffs are explicit.</li>
                <li>Dissent is preserved, not memory-holed.</li>
              </ul>
              <div className="mt-auto pt-4 text-sm">
                <Link
                  to="/faq#why-technical"
                  className="font-semibold text-neutral-900 hover:text-neutral-700"
                >
                  FAQ: Why the technical language?
                </Link>
              </div>
            </Card>
          </div>
        </section>

        <section className="mb-12" id="governance">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">Governance</h2>
          </div>
          <Card className="border border-neutral-200 bg-white p-6 h-full">
            <ul className="space-y-2 text-sm text-neutral-600">
              <li>Civic Lab is a curated system.</li>
              <li>The Canon has final editorial oversight (benevolent dictator model).</li>
              <li>Country Manuals can be stewarded by appointed maintainers.</li>
              <li>
                Global Red Team and adjudication functions are designed to
                prevent local bubbles and improve rigor.
              </li>
              <li>
                This structure is explicit because the alternative is hidden
                power and invisible drift.
              </li>
            </ul>
            <div className="mt-auto pt-4 text-sm">
              <Link
                to="/faq#governance-roles"
                className="font-semibold text-neutral-900 hover:text-neutral-700"
              >
                FAQ: Governance and roles
              </Link>
            </div>
          </Card>
        </section>

        <section className="mb-12" id="who-this-is-for">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Who This Is For
            </h2>
          </div>
          <Card className="border border-neutral-200 bg-white p-6 h-full">
            <ul className="space-y-2 text-sm text-neutral-600">
              <li>
                People who want to treat governance like engineering: mechanisms,
                incentives, failure modes, and tests.
              </li>
              <li>
                People willing to write clearly, cite sources, quantify claims
                when possible, and keep disagreements legible.
              </li>
              <li>
                Practitioners, researchers, and serious independents who want a
                high-signal place to build long-range synthesis.
              </li>
            </ul>
            <div className="mt-auto pt-4 text-sm">
              <Link
                to="/faq#participation-ladder"
                className="font-semibold text-neutral-900 hover:text-neutral-700"
              >
                FAQ: Participation ladder
              </Link>
            </div>
          </Card>
        </section>

        <section className="mb-12" id="get-involved">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              Get Involved
            </h2>
            <div className="mt-3 text-sm">
              <Link
                to="/faq#onboarding"
                className="font-semibold text-neutral-900 hover:text-neutral-700"
              >
                FAQ: Onboarding paths
              </Link>
            </div>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border border-neutral-200 bg-white p-6">
              <p className="text-sm text-neutral-600">
                The site is readable by anyone. Contribution access is gated to
                keep quality high.
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li>Read: browse the Canon and Country Manuals.</li>
                <li>
                  Join discussion: participate in dossier threads and RFC reviews
                  (verified access).
                </li>
                <li>
                  Help build: steward a dossier, contribute revisions, or
                  participate in Red Team reviews.
                </li>
              </ul>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6 h-full">
              <p className="text-sm text-neutral-600">
                If you want to contribute, start by reading a dossier you care
                about and opening a thread with either:
              </p>
              <ul className="mt-4 space-y-2 text-sm text-neutral-600">
                <li>a concrete correction,</li>
                <li>a resolvable claim,</li>
                <li>a structured objection (red-team style),</li>
                <li>or a well-scoped RFC proposal.</li>
              </ul>
              <div className="mt-auto pt-4 text-sm">
                <Link
                  to="/faq#unfamiliar-terms"
                  className="font-semibold text-neutral-900 hover:text-neutral-700"
                >
                  FAQ: What if I hit unfamiliar terms?
                </Link>
              </div>
            </Card>
          </div>
        </section>

        <section className="mb-12" id="what-to-expect">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold text-neutral-900">
              What You Can Expect
            </h2>
          </div>
          <Card className="border border-neutral-200 bg-white p-6">
            <ul className="space-y-2 text-sm text-neutral-600">
              <li>Strong opinions, explicit assumptions, and transparent decision-making.</li>
              <li>A living archive of disagreement—kept readable and attributable.</li>
              <li>A place where synthesis is allowed, but hand-waving isn’t.</li>
            </ul>
          </Card>
        </section>

        <section>
          <Card className="border border-neutral-200 bg-white p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-semibold text-neutral-900">
                  Ready to explore?
                </h2>
                <p className="mt-2 text-sm text-neutral-600">
                  Start with the Canon or browse a Country Manual to see the
                  system in action.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/dossier/canon-1">
                    Explore Canon
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/dossier/manual-us-1">Browse Manuals</Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>
      </main>
    </div>
  );
}
