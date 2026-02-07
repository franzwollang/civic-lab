import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { RevSetRow } from "../components/revset-row";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { CheckCircle2, User, Clock, Info } from "lucide-react";
import { useParams, Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

export function RfcThreadPage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId="us-voting-1" currentPage="rfc" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[900px] px-8 py-8">
          {/* RFC Header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <StatusBadge status="RFC" />
              <span className="text-sm text-neutral-500">RFC #{id}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-neutral-400" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      RFC (Request for Change) enables structured revision mechanics with diff previews and review workflows.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-neutral-900">
              Specify chain of custody for provisional ballots
            </h1>

            {/* Thread Targets */}
            <div className="mb-4 rounded-lg border border-neutral-200 bg-white p-4">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-neutral-500">
                Thread Targets
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600">Dossier:</span>
                  <Link
                    to="/dossier/us-voting-1"
                    className="font-medium text-neutral-900 hover:text-neutral-700"
                  >
                    US Voting Implementation Guide
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600">Artifact:</span>
                  <Link
                    to="/dossier/us-voting-1/artifact/provisional"
                    className="font-medium text-neutral-900 hover:text-neutral-700"
                  >
                    Provisional Ballot Handling
                  </Link>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-neutral-600">Section:</span>
                  <span className="font-medium text-neutral-900">
                    Storage and Transport
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* RFC Header Block */}
          <Card className="mb-8 border-2 border-amber-500 bg-amber-50 p-6">
            <div className="mb-4 flex items-center gap-2">
              <div className="rounded bg-amber-600 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-white">
                Request for Change
              </div>
            </div>

            <div className="space-y-4">
              {/* Scope */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                  Scope
                </h3>
                <p className="text-sm text-neutral-800">
                  Add explicit chain of custody procedures to the "Storage and
                  Transport" section of the Provisional Ballot Handling artifact.
                  Define minimum requirements for personnel, documentation, and
                  incident handling when transporting provisional ballots from
                  polling locations to central counting facilities.
                </p>
              </div>

              <Separator className="bg-amber-200" />

              {/* Intent */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                  Intent
                </h3>
                <p className="text-sm text-neutral-800">
                  Resolve ambiguity identified in Red Team Finding #RT-042
                  (Critical severity). Ensure consistent security standards across
                  all jurisdictions while maintaining alignment with Canon
                  principles on secure physical transport.
                </p>
              </div>

              <Separator className="bg-amber-200" />

              {/* Acceptance Criteria */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                  Acceptance Criteria
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    <span className="text-neutral-800">
                      Specifies training requirements for transport personnel
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    <span className="text-neutral-800">
                      Defines documentation standards (manifest + chain of custody
                      log)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    <span className="text-neutral-800">
                      Establishes tamper-evident seal requirements
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    <span className="text-neutral-800">
                      Provides incident reporting procedure for compromised
                      integrity
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
                    <span className="text-neutral-800">
                      Explicitly references Canon/Security/Physical-Transport
                      principles
                    </span>
                  </div>
                </div>
              </div>

              <Separator className="bg-amber-200" />

              {/* Review Checklist */}
              <div>
                <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                  Review Checklist
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      disabled
                      checked
                    />
                    <span className="text-neutral-800">
                      Canon alignment verified by Alignment team
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" disabled />
                    <span className="text-neutral-800">
                      Legal review complete (state law compliance)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" disabled />
                    <span className="text-neutral-800">
                      Red Team sign-off (addresses RT-042)
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <input type="checkbox" className="mt-1" disabled />
                    <span className="text-neutral-800">
                      Operational feasibility confirmed by 3+ jurisdictions
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Revision Sets */}
          <div className="mb-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Revision Sets
            </h2>
            <Card className="border border-neutral-200 bg-white">
              <RevSetRow
                version={3}
                author="Alex Rivera"
                timestamp="1 hour ago"
                description="Addressed legal review feedback"
                isCurrent={true}
              />
              <RevSetRow
                version={2}
                author="Alex Rivera"
                timestamp="5 hours ago"
                description="Added Canon reference per feedback"
              />
              <RevSetRow
                version={1}
                author="Alex Rivera"
                timestamp="8 hours ago"
                description="Initial draft"
              />
            </Card>
          </div>

          {/* Decision Widget */}
          <Card className="border-2 border-neutral-300 bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold text-neutral-900">
              Decision
            </h3>
            <p className="mb-4 text-sm text-neutral-600">
              Once all review criteria are met, the dossier steward can merge,
              reject, or park this RFC.
            </p>
            <div className="flex gap-3">
              <Button variant="default" size="lg" disabled>
                Merge RFC
              </Button>
              <Button variant="outline" size="lg" disabled>
                Reject
              </Button>
              <Button variant="outline" size="lg" disabled>
                Park
              </Button>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Decision controls are disabled in this prototype
            </p>
          </Card>

          {/* Discussion Thread */}
          <div className="mt-8">
            <h2 className="mb-4 text-xl font-semibold text-neutral-900">
              Discussion
            </h2>
            <div className="space-y-4">
              <Card className="border border-neutral-200 bg-white p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-500 text-white">
                    <span className="text-sm font-semibold">JL</span>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">Jamie Lee</div>
                    <div className="text-sm text-neutral-500">2 hours ago</div>
                  </div>
                </div>
                <div className="prose prose-neutral prose-sm max-w-none">
                  <p>
                    Revision 3 looks good. The Canon reference is properly
                    structured and the legal language is clearer now.
                  </p>
                  <p>
                    Once we get Red Team sign-off that this addresses RT-042, I
                    think we're ready to merge.
                  </p>
                </div>
              </Card>

              <Card className="border-2 border-dashed border-neutral-300 bg-white p-6">
                <div className="text-center text-sm text-neutral-500">
                  <p>Reply interface would appear here</p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}