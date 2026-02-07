import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { StatusBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { Separator } from "../components/ui/separator";
import { User, Clock, GitBranch, Flag } from "lucide-react";
import { useParams, Link } from "react-router";

export function ThreadPage() {
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId="us-voting-1" currentPage="thread" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[900px] px-8 py-8">
          {/* Thread Header */}
          <div className="mb-8">
            <div className="mb-4 flex items-center gap-3">
              <StatusBadge status="Open" />
              <span className="text-sm text-neutral-500">Thread #{id}</span>
            </div>
            <h1 className="mb-4 text-3xl font-bold text-neutral-900">
              Clarify chain of custody for provisional ballots
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

            {/* Tags */}
            <div className="mb-4 flex flex-wrap gap-2">
              <Badge variant="secondary">chain-of-custody</Badge>
              <Badge variant="secondary">security</Badge>
              <Badge variant="secondary">transport</Badge>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <Link to={`/thread/${id}/rfc`}>
                <Button variant="default" size="sm">
                  <GitBranch className="mr-2 h-4 w-4" />
                  Nominate for RFC
                </Button>
              </Link>
              <Button variant="outline" size="sm">
                <Flag className="mr-2 h-4 w-4" />
                Flag Candidate Finding
              </Button>
            </div>
          </div>

          {/* Thread Timeline */}
          <div className="space-y-4">
            {/* Message 1 */}
            <Card className="border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white">
                    <span className="text-sm font-semibold">AR</span>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">
                      Alex Rivera
                    </div>
                    <div className="text-sm text-neutral-500">
                      4 hours ago · Thread starter
                    </div>
                  </div>
                </div>
              </div>
              <div className="prose prose-neutral prose-sm max-w-none">
                <p>
                  The current artifact specifies that provisional ballots should
                  be "transported to central facility with two-person escort" but
                  this is noted as "under review per RFC #RT-042."
                </p>
                <p>
                  I think we need more explicit guidance here. Specifically:
                </p>
                <ul>
                  <li>
                    Who is authorized to be part of the two-person escort? Can it
                    be any two poll workers, or do they need specific training?
                  </li>
                  <li>
                    What documentation is required at pickup and delivery? Just
                    signatures, or do we need photo/video documentation?
                  </li>
                  <li>
                    What happens if the sealed container shows signs of tampering
                    upon arrival at central facility?
                  </li>
                </ul>
                <p>
                  This seems like a significant enough gap that it might warrant
                  escalation to an RFC to properly define the procedure.
                </p>
              </div>
            </Card>

            {/* Message 2 */}
            <Card className="border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-700 text-white">
                    <span className="text-sm font-semibold">MJ</span>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">
                      Mark Johnson
                    </div>
                    <div className="text-sm text-neutral-500">
                      3 hours ago · Dossier Steward
                    </div>
                  </div>
                </div>
              </div>
              <div className="prose prose-neutral prose-sm max-w-none">
                <p>
                  Good catch, Alex. You're right that this is currently
                  underspecified.
                </p>
                <p>
                  The historical context is that we initially had much more
                  detailed procedures here, but they were state-specific and we
                  moved them to individual state annexes. What's left in the main
                  artifact is the general principle, but it's too vague.
                </p>
                <p>
                  I support elevating this to an RFC. We should specify:
                </p>
                <ol>
                  <li>
                    Minimum training requirements for transport team members
                  </li>
                  <li>
                    Documentation standards (I think manifest + chain of custody
                    log should be sufficient without requiring photo/video)
                  </li>
                  <li>Tamper-evident seal standards</li>
                  <li>
                    Incident reporting procedures if integrity is compromised
                  </li>
                </ol>
              </div>
            </Card>

            {/* Message 3 */}
            <Card className="border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-500 text-white">
                    <span className="text-sm font-semibold">JL</span>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">Jamie Lee</div>
                    <div className="text-sm text-neutral-500">2 hours ago</div>
                  </div>
                </div>
              </div>
              <div className="prose prose-neutral prose-sm max-w-none">
                <p>
                  Agreed this needs RFC treatment. I'd also add that we should
                  reference the Canon artifact on "Secure Transport Principles"
                  (Canon/Security/Physical-Transport) to ensure alignment between
                  ideal and execution.
                </p>
                <p>
                  That canon artifact establishes the baseline requirements for
                  two-person integrity and tamper-evident containers. Our manual
                  should explicitly map to those principles.
                </p>
              </div>
            </Card>

            {/* Message 4 */}
            <Card className="border border-neutral-200 bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-900 text-white">
                    <span className="text-sm font-semibold">AR</span>
                  </div>
                  <div>
                    <div className="font-medium text-neutral-900">
                      Alex Rivera
                    </div>
                    <div className="text-sm text-neutral-500">1 hour ago</div>
                  </div>
                </div>
              </div>
              <div className="prose prose-neutral prose-sm max-w-none">
                <p>
                  Perfect. I'll draft the RFC scope and intent statement. Should
                  have a first revision ready by end of day.
                </p>
                <p>
                  Will explicitly reference Canon/Security/Physical-Transport per
                  Jamie's suggestion.
                </p>
              </div>
            </Card>

            {/* Reply Box */}
            <Card className="border-2 border-dashed border-neutral-300 bg-white p-6">
              <div className="text-center text-sm text-neutral-500">
                <p>Reply interface would appear here</p>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
