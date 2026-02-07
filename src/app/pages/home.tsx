import { Header } from "../components/header";
import { DossierCard, ThreadRow } from "../components/cards";
import { LaneBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
import { ArrowRight, BookOpen, MapPin, User, Clock, ChevronRight } from "lucide-react";
import { Link } from "react-router";

export function Home() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto max-w-[1440px] px-8 py-12">
        {/* Hero Cards */}
        <div className="mb-16 grid grid-cols-2 gap-6">
          <Link to="/dossier/canon-1">
            <Card className="group cursor-pointer border-2 border-neutral-900 bg-white p-8 transition-all hover:border-neutral-700 hover:shadow-lg">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-neutral-900">
                  <BookOpen className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-neutral-900">Canon</h2>
                  <Badge className="mt-1 bg-blue-50 text-blue-700">
                    Ideal
                  </Badge>
                </div>
              </div>
              <p className="mb-4 text-neutral-600">
                The foundational knowledge base. Descriptive truths, theoretical
                frameworks, and ideal-state principles that guide all execution.
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
                  <Badge className="mt-1 bg-purple-50 text-purple-700">
                    Execution
                  </Badge>
                </div>
              </div>
              <p className="mb-4 text-neutral-600">
                Context-specific implementation guides. Prescriptive workflows,
                localized procedures, and executable strategies for each jurisdiction.
              </p>
              <div className="flex items-center gap-2 text-sm font-medium text-neutral-900 group-hover:text-neutral-700">
                <span>Browse Manuals</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </div>
            </Card>
          </Link>
        </div>

        {/* Trending Dossiers */}
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
                      <LaneBadge lane="Descriptive" />
                      <Badge variant="secondary">Example</Badge>
                    </div>
                    <h3 className="mb-2 text-lg font-semibold text-neutral-900 group-hover:text-neutral-700">
                      2024 Election Turnout Intelligence
                    </h3>
                    <p className="mb-4 text-sm text-neutral-600">
                      Intelligence gathering with structured, scorable claims showing forecast accuracy and claim quality metrics.
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

        {/* Recent RFCs */}
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

        {/* Recent Red Team Findings */}
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
                  Section 4.2 lacks explicit procedure for transferring provisional
                  ballots between polling site and central counting facility.
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