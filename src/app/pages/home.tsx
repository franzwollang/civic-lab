import { Header } from "../components/header";
import { DossierCard, ThreadRow } from "../components/cards";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  ArrowRight,
  BookOpen,
  MapPin,
  User,
  Clock,
  ChevronRight,
  Sparkles,
  MessageSquare,
  GitPullRequest,
  ShieldCheck,
  Target,
  Scale,
  ArrowUpRight,
} from "lucide-react";
import { Link } from "react-router";

export function Home() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-[1440px] px-8 py-12">
        <section className="mb-16">
          <div className="relative overflow-hidden rounded-3xl border border-neutral-200 bg-gradient-to-br from-white via-neutral-50 to-neutral-100 p-10">
            <div className="absolute -right-28 -top-28 h-72 w-72 rounded-full bg-neutral-200/60 blur-3xl" />
            <div className="absolute -bottom-24 left-0 h-56 w-56 -translate-x-1/2 rounded-full bg-blue-100/50 blur-3xl" />
            <div className="relative grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
              <div>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600">
                  <Sparkles className="h-3 w-3 text-neutral-700" />
                  Governance Engineering Lab
                </div>
                <h1 className="mb-4 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
                  Civic Lab
                </h1>
                <p className="mb-4 text-lg text-neutral-700">
                  A governance engineering lab for living specs, adversarial
                  review, and transparent uncertainty.
                </p>
                <p className="text-sm text-neutral-600">
                  Civic Lab is a forum/wiki hybrid for building revisioned
                  knowledge bases about political systems, economic systems,
                  voting systems, cultural institutions, and the real-world
                  plans needed to move societies toward better outcomes.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild size="lg">
                    <Link to="/dossier/canon-1">
                      Explore Canon
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline">
                    <Link to="/dossier/manual-us-1">Browse Manuals</Link>
                  </Button>
                  <Button
                    asChild
                    size="lg"
                    variant="ghost"
                    className="text-neutral-700"
                  >
                    <Link to="/about">What is this?</Link>
                  </Button>
                </div>
              </div>
              <div className="space-y-4">
                <Card className="border border-neutral-200 bg-white/90 p-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <Scale className="h-4 w-4" />
                    Not Neutral by Design
                  </div>
                  <p className="text-sm text-neutral-600">
                    Civic Lab has an explicit constitution and a clear
                    editor-in-chief model. The trade: higher signal, stronger
                    standards, and an auditable trail of reasoning.
                  </p>
                </Card>
                <Card className="border border-neutral-200 bg-white/90 p-6">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                    <Target className="h-4 w-4" />
                    Standards and Uncertainty
                  </div>
                  <ul className="space-y-2 text-sm text-neutral-600">
                    <li>Assumptions are explicit.</li>
                    <li>Uncertainty is tracked, not hidden.</li>
                    <li>Claims are tied to evidence where possible.</li>
                  </ul>
                </Card>
                <Card className="border border-neutral-200 bg-white/90 p-6">
                  <div className="mb-3 text-sm font-semibold text-neutral-900">
                    How To Read This Site
                  </div>
                  <p className="text-sm text-neutral-600">
                    You’ll encounter math, CS, and other technical terms. They’re
                    optional precision tools: start with plain-language
                    summaries, and expand the formal layer when you want to audit
                    reasoning.
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <Link
                      to="/faq#do-i-need-math"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-700"
                    >
                      Read the FAQ
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                    <Link
                      to="/constitution"
                      className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-900 hover:text-neutral-700"
                    >
                      Read the Constitution
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-16" id="two-channels">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">
                Two Channels
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Ideals live in the Canon. Execution lives in Country Manuals.
              </p>
            </div>
            <Link
              to="/about#two-channels"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Learn more →
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Link to="/dossier/canon-1">
              <Card className="group cursor-pointer border-2 border-neutral-900 bg-white p-8 transition-all hover:border-neutral-700 hover:shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-900">
                    <BookOpen className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">
                      Canon
                    </h2>
                    <Badge className="mt-1 bg-blue-50 text-blue-700">
                      Ideal
                    </Badge>
                  </div>
                </div>
                <p className="mb-4 text-neutral-600">
                  The spec: core principles, constraints, invariants, and
                  mechanisms—plus the tests, metrics, and failure modes that let
                  us argue about it rigorously.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
                  <span>Explore Canon</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>

            <Link to="/dossier/manual-us-1">
              <Card className="group cursor-pointer border-2 border-neutral-900 bg-white p-8 transition-all hover:border-neutral-700 hover:shadow-lg">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-900">
                    <MapPin className="h-6 w-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-neutral-900">
                      Country Manuals
                    </h2>
                    <Badge className="mt-1 bg-emerald-50 text-emerald-700">
                      Execution
                    </Badge>
                  </div>
                </div>
                <p className="mb-4 text-neutral-600">
                  Pragmatic field guides: current conditions, constraints,
                  incentives, and stepwise plans. Bluntly realistic, yet
                  intellectually honest.
                </p>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
                  <span>Browse Manuals</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>
          </div>
        </section>

        <section className="mb-16" id="workflow">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900">
                How Work Gets Done
              </h2>
              <p className="mt-2 text-sm text-neutral-600">
                Threads, RFCs, and Red Team review keep change control rigorous.
              </p>
            </div>
            <Link
              to="/about#workflow"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              Process overview →
            </Link>
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <Card className="border border-neutral-200 bg-white p-6">
              <MessageSquare className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                Threads-first Collaboration
              </h3>
              <p className="text-sm text-neutral-600">
                Discussion happens in threads attached to dossiers, not scattered
                comment sections.
              </p>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6">
              <GitPullRequest className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                RFC Workflow
              </h3>
              <p className="text-sm text-neutral-600">
                Threads can be promoted to an RFC, bundling revisions, diffs, and
                review into an auditable path from proposal to merge.
              </p>
            </Card>
            <Card className="border border-neutral-200 bg-white p-6">
              <ShieldCheck className="mb-4 h-5 w-5 text-neutral-700" />
              <h3 className="mb-2 text-lg font-semibold text-neutral-900">
                Red Team Cases
              </h3>
              <p className="text-sm text-neutral-600">
                First-class dissent yields structured findings, mitigation
                discussions, and accepted-risk signoffs.
              </p>
            </Card>
          </div>
        </section>

        <section className="mb-16" id="get-involved">
          <Card className="border border-neutral-200 bg-white p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Badge className="bg-neutral-100 text-neutral-700" variant="secondary">
                  Get Involved
                </Badge>
                <h3 className="mt-3 text-2xl font-semibold text-neutral-900">
                  Start with a dossier you care about
                </h3>
                <p className="mt-2 max-w-2xl text-sm text-neutral-600">
                  Open a thread with a concrete correction, a resolvable claim, a
                  structured objection, or a well-scoped RFC proposal.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild>
                  <Link to="/about#get-involved">
                    Contribution Guide
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline">
                  <Link to="/about">What is Civic Lab?</Link>
                </Button>
              </div>
            </div>
          </Card>
        </section>

        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-neutral-900">
              Trending Dossiers
            </h3>
            <Link
              to="/"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-4">
            <DossierCard
              id="electoral-1"
              title="Electoral System Design"
              description="Foundational principles for democratic electoral mechanisms, voting theory, and representation models."
              lane="Descriptive"
              steward="Dr. Sarah Chen"
              lastUpdated="2 days ago"
              artifactCount={12}
              threadCount={8}
            />
            <DossierCard
              id="us-voting-1"
              title="US Voting Implementation Guide"
              description="State-by-state procedures, legal requirements, and operational workflows for conducting elections in the United States."
              lane="Prescriptive"
              steward="Mark Johnson"
              lastUpdated="3 hours ago"
              artifactCount={24}
              threadCount={15}
            />
            <Link to="/dossier/us-voting-1/artifact-descriptive/turnout-intel">
              <Card className="group cursor-pointer border border-blue-200 bg-blue-50 p-6 transition-all hover:border-blue-300 hover:shadow-sm">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <Badge className="bg-blue-100 text-blue-700">
                        Descriptive
                      </Badge>
                      <Badge variant="secondary">Example</Badge>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-900 group-hover:text-neutral-700">
                      2024 Election Turnout Intelligence
                    </h3>
                    <p className="mb-4 text-sm text-neutral-600">
                      Intelligence gathering with structured, scorable claims
                      showing forecast accuracy and claim quality metrics.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-neutral-500">
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        <span>Research Team</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>1 day ago</span>
                      </div>
                      <span>·</span>
                      <span>12 claims</span>
                      <span>·</span>
                      <span>2 threads</span>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-neutral-400 transition-transform group-hover:translate-x-1" />
                </div>
              </Card>
            </Link>
            <DossierCard
              id="alignment-1"
              title="Canon ↔ US Manual Alignment Check"
              description="Tracking alignment between ideal electoral principles and practical US implementation constraints."
              lane="Alignment"
              steward="Review Board"
              lastUpdated="1 day ago"
              artifactCount={8}
              threadCount={12}
            />
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-neutral-900">
              Recent RFCs
            </h3>
            <Link
              to="/"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              View all →
            </Link>
          </div>
          <Card className="border border-neutral-200 bg-white p-6">
            <div className="divide-y divide-neutral-200">
              <ThreadRow
                id="rfc-1"
                title="Proposal: Add ranked-choice voting framework to Canon"
                status="RFC"
                author="Alex Rivera"
                messageCount={23}
                lastActivity="4 hours ago"
              />
              <ThreadRow
                id="rfc-2"
                title="RFC: Update voter registration procedures for digital ID"
                status="Review"
                author="Jamie Lee"
                messageCount={17}
                lastActivity="1 day ago"
              />
              <ThreadRow
                id="rfc-3"
                title="Merge mail-in ballot security protocols"
                status="Decided"
                author="Taylor Kim"
                messageCount={31}
                lastActivity="2 days ago"
              />
            </div>
          </Card>
        </section>

        <section>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-xl font-semibold text-neutral-900">
              Recent Red Team Findings
            </h3>
            <Link
              to="/dossier/us-voting-1/red-team/1"
              className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
            >
              View all →
            </Link>
          </div>
          <div className="grid gap-3">
            <Link to="/dossier/us-voting-1/red-team/1">
              <div className="cursor-pointer rounded-lg border-l-4 border-l-red-500 border-t border-r border-b border-neutral-200 bg-white p-4 transition-all hover:shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-red-50 text-red-700">Critical</Badge>
                    <Badge className="bg-orange-50 text-orange-700">Open</Badge>
                  </div>
                  <span className="text-xs text-neutral-500">
                    US Voting Implementation
                  </span>
                </div>
                <h4 className="mb-1 font-semibold text-neutral-900">
                  Chain of custody gap in provisional ballot handling
                </h4>
                <p className="text-sm text-neutral-600">
                  Section 4.2 lacks explicit procedure for transferring
                  provisional ballots between polling site and central counting
                  facility.
                </p>
              </div>
            </Link>
            <Link to="/dossier/us-voting-1/red-team/1">
              <div className="cursor-pointer rounded-lg border-l-4 border-l-orange-500 border-t border-r border-b border-neutral-200 bg-white p-4 transition-all hover:shadow-sm">
                <div className="mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-orange-50 text-orange-700">High</Badge>
                    <Badge className="bg-orange-50 text-orange-700">Open</Badge>
                  </div>
                  <span className="text-xs text-neutral-500">
                    US Voting Implementation
                  </span>
                </div>
                <h4 className="mb-1 font-semibold text-neutral-900">
                  Ambiguous voter ID requirements for absentee voters
                </h4>
                <p className="text-sm text-neutral-600">
                  Inconsistent specification across Section 3.1 and Appendix B
                  regarding acceptable forms of ID verification.
                </p>
              </div>
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
