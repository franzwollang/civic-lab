import { useMemo } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { LaneBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ExternalLink, MessageSquare, GitBranch, Info } from "lucide-react";
import { useParams, Link } from "react-router";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";
import {
  ArtifactDocumentBody,
  useArtifactDocument,
} from "@/doc/ArtifactDocumentBody";

function StaticProvisionalBody() {
  return (
    <div className="prose prose-neutral max-w-none">
      <h2>Overview</h2>
      <p>
        Provisional ballots are a critical safeguard mechanism that ensures
        eligible voters can cast a ballot even when questions arise about their
        registration or eligibility at the polling place. This artifact defines
        when provisional ballots must be issued, how they should be handled, and
        the verification process for counting.
      </p>

      <div className="my-6 rounded-lg border-l-4 border-l-blue-500 bg-blue-50 p-4">
        <h4 className="mb-2 font-semibold text-blue-900">Key Principle</h4>
        <p className="text-sm text-blue-800">
          No eligible voter should be turned away from the polls. When in doubt,
          issue a provisional ballot and resolve eligibility during the
          canvassing period.
        </p>
      </div>

      <h2>When to Issue Provisional Ballots</h2>
      <p>
        Poll workers must offer a provisional ballot in the following
        circumstances:
      </p>
      <ul>
        <li>
          Voter&apos;s name does not appear in the poll book or electronic
          registration system
        </li>
        <li>
          Voter claims to have registered but registration cannot be verified
        </li>
        <li>Voter lacks required identification documents</li>
        <li>
          Voter&apos;s eligibility is challenged by an authorized poll watcher
        </li>
        <li>
          Voter has moved within the jurisdiction but to a different precinct
        </li>
        <li>
          Absentee ballot records indicate voter already received a mail ballot,
          but voter claims not to have voted it
        </li>
      </ul>

      <h2>Issuance Procedure</h2>
      <ol>
        <li>
          <strong>Explain the process:</strong> Poll worker informs voter that
          they will cast a provisional ballot and explains the verification
          timeline
        </li>
        <li>
          <strong>Complete envelope:</strong> Voter completes provisional ballot
          envelope with contact information and affirmation statement
        </li>
        <li>
          <strong>Mark poll book:</strong> Poll worker records provisional
          ballot issuance in poll book with unique identifier
        </li>
        <li>
          <strong>Voter marks ballot:</strong> Voter completes ballot in privacy
          booth
        </li>
        <li>
          <strong>Seal envelope:</strong> Voter seals marked ballot in
          provisional envelope
        </li>
        <li>
          <strong>Provide receipt:</strong> Poll worker provides voter with
          tear-off receipt containing tracking number
        </li>
      </ol>

      <div className="my-6 rounded-lg border-l-4 border-l-amber-500 bg-amber-50 p-4">
        <h4 className="mb-2 font-semibold text-amber-900">Critical Alert</h4>
        <p className="text-sm text-amber-800">
          <strong>Red Team Finding #RT-042:</strong> Current procedure lacks
          explicit chain of custody requirements for transporting provisional
          ballots from polling place to central counting facility. This has been
          flagged as a Critical severity finding.
        </p>
      </div>

      <h2>Storage and Transport</h2>
      <p>
        Provisional ballots must be kept separate from regular ballots throughout
        the process:
      </p>
      <ul>
        <li>Store in designated sealed container at polling place</li>
        <li>
          Transport to central facility with two-person escort (requirement under
          review per RFC #RT-042)
        </li>
        <li>
          Log chain of custody at each transfer point with timestamps and
          signatures
        </li>
      </ul>

      <h2>Verification Process</h2>
      <p>
        The canvassing board must verify eligibility of each provisional ballot
        within 7 days of the election:
      </p>
      <ol>
        <li>Check voter registration database</li>
        <li>Verify voter signature against registration records</li>
        <li>Confirm voter did not cast another ballot in the election</li>
        <li>
          Determine if voter was in correct jurisdiction (county-level races
          count even if wrong precinct)
        </li>
        <li>Accept or reject ballot with documented reason code</li>
      </ol>
    </div>
  );
}

export function ArtifactPage() {
  const { dossierId, artifactId } = useParams();
  const doc = useArtifactDocument(artifactId);

  const title = useMemo(() => {
    if (doc.status === "ready") return doc.artifact.title;
    return "Provisional Ballot Handling";
  }, [doc]);

  const updatedLabel = useMemo(() => {
    if (doc.status === "ready") {
      const d = new Date(doc.revision.created_at);
      return `Revision ${doc.revision.revision_id.slice(0, 8)} · ${d.toLocaleDateString()}`;
    }
    return "Last updated: 2 days ago · Updated by Mark Johnson";
  }, [doc]);

  const showLive = doc.status === "ready";

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav dossierId={dossierId} currentPage="artifact" />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          <div className="flex gap-8">
            <article className="flex-1">
              <div className="mb-6">
                <div className="mb-2 text-sm text-neutral-500">
                  <Link
                    to={`/dossier/${dossierId}`}
                    className="hover:text-neutral-700"
                  >
                    US Voting Implementation Guide
                  </Link>{" "}
                  / Artifact
                </div>
                <div className="mb-4 flex items-center gap-3">
                  <LaneBadge lane="Prescriptive" />
                  {showLive && (
                    <Badge variant="secondary">Live revision</Badge>
                  )}
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger>
                        <Info className="h-4 w-4 text-neutral-400" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        <p className="text-xs">
                          <strong>Prescriptive Lane:</strong> Contains
                          objective-conditional strategy and procedures
                          attributed to an actor/owner. Focus on actionable
                          plans.
                        </p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <h1 className="mb-4 text-3xl font-bold text-neutral-900">
                  {title}
                </h1>
                <div className="flex items-center gap-4 text-sm text-neutral-600">
                  <span>{updatedLabel}</span>
                  {showLive && (
                    <>
                      <span>·</span>
                      <span>Author: {doc.revision.author}</span>
                      <span>·</span>
                      <Link
                        to={`/test/preview/${doc.artifact.page_id}`}
                        className="text-neutral-700 underline-offset-2 hover:underline"
                      >
                        Open test preview
                      </Link>
                    </>
                  )}
                </div>
              </div>

              <div className="mb-8 flex gap-3">
                <Link to="/thread/thread-1">
                  <Button variant="default" size="sm">
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Start Thread
                  </Button>
                </Link>
                <Link to="/thread/thread-1/rfc">
                  <Button variant="outline" size="sm">
                    <GitBranch className="mr-2 h-4 w-4" />
                    Nominate for RFC
                  </Button>
                </Link>
              </div>

              {!showLive && (
                <Card className="mb-8 border border-neutral-200 bg-white p-6">
                  <h3 className="mb-4 text-lg font-semibold text-neutral-900">
                    Linked Threads & RFCs
                  </h3>
                  <div className="space-y-3">
                    <Link
                      to="/thread/thread-1"
                      className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 transition-colors hover:bg-neutral-50"
                    >
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Clarify chain of custody for provisional ballots
                        </div>
                        <div className="text-sm text-neutral-500">
                          References Section: Storage and Transport · 4 messages
                          · Open
                        </div>
                      </div>
                      <Badge className="bg-neutral-50 text-neutral-700">
                        Open
                      </Badge>
                    </Link>
                    <Link
                      to="/thread/thread-1/rfc"
                      className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 transition-colors hover:bg-amber-100"
                    >
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          RFC: Specify chain of custody for provisional ballots
                        </div>
                        <div className="text-sm text-neutral-500">
                          Targets Section: Storage and Transport · v3 current ·
                          In review
                        </div>
                      </div>
                      <Badge className="bg-amber-600 text-white">RFC</Badge>
                    </Link>
                  </div>
                </Card>
              )}

              {doc.status === "loading" && (
                <Card className="border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
                  Loading artifact document…
                </Card>
              )}

              {doc.status === "error" && (
                <Card className="mb-4 border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Could not load live revision ({doc.message}). Showing fixture
                  copy.
                </Card>
              )}

              {doc.status === "ready" ? (
                <Card className="border border-neutral-200 bg-white p-8">
                  <ArtifactDocumentBody load={doc} />
                </Card>
              ) : doc.status !== "loading" ? (
                <Card className="border border-neutral-200 bg-white p-8">
                  <StaticProvisionalBody />
                  <p className="mt-8 text-xs text-neutral-500">
                    Tip: open{" "}
                    <Link
                      to={`/dossier/${dossierId}/artifact/voting-systems`}
                      className="underline underline-offset-2"
                    >
                      /artifact/voting-systems
                    </Link>{" "}
                    (or{" "}
                    <Link
                      to={`/dossier/${dossierId}/artifact/page-001`}
                      className="underline underline-offset-2"
                    >
                      page-001
                    </Link>
                    ) for the seeded ArtifactRevision via DocumentReader.
                  </p>
                </Card>
              ) : null}
            </article>

            <aside className="w-80">
              <div className="space-y-6">
                <Card className="border border-neutral-200 p-6">
                  <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                    Metadata
                  </h3>
                  <div className="space-y-3 text-sm">
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Artifact ID
                      </div>
                      <div className="text-neutral-600">
                        {showLive ? doc.artifact.page_id : artifactId}
                      </div>
                    </div>
                    {showLive && (
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Slug
                        </div>
                        <div className="text-neutral-600">
                          {doc.artifact.slug}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Dossier
                      </div>
                      <Link
                        to={`/dossier/${dossierId}`}
                        className="text-neutral-600 hover:text-neutral-900"
                      >
                        US Voting Implementation Guide
                      </Link>
                    </div>
                    <div>
                      <div className="mb-1 font-medium text-neutral-900">
                        Version
                      </div>
                      <div className="text-neutral-600">
                        {showLive
                          ? doc.revision.revision_id.slice(0, 8)
                          : "v2.1"}
                      </div>
                    </div>
                    {!showLive && (
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Tags
                        </div>
                        <div className="flex flex-wrap gap-1">
                          <Badge variant="secondary">provisional</Badge>
                          <Badge variant="secondary">ballots</Badge>
                          <Badge variant="secondary">procedures</Badge>
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                {showLive && doc.sections.length > 0 && (
                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Sections
                    </h3>
                    <ul className="space-y-2 text-sm">
                      {doc.sections.map((section) => (
                        <li
                          key={section.stable_key}
                          className={
                            section.level === 2
                              ? "font-medium text-neutral-900"
                              : "pl-3 text-neutral-600"
                          }
                        >
                          <span className="text-neutral-400">
                            {section.stable_key}
                          </span>
                          <span className="mx-1 text-neutral-300">·</span>
                          {section.title}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-3 text-xs text-neutral-500">
                      Stable keys from heading block ids (Section plan; DB sync
                      deferred).
                    </p>
                  </Card>
                )}

                {!showLive && (
                  <>
                    <Card className="border border-neutral-200 p-6">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                        Referenced Claims
                      </h3>
                      <div className="space-y-3">
                        <div className="text-sm">
                          <div className="mb-1 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="font-medium text-neutral-900">
                              Claim #C-1024
                            </span>
                          </div>
                          <p className="text-neutral-600">
                            HAVA requires provisional ballot option
                          </p>
                        </div>
                        <div className="text-sm">
                          <div className="mb-1 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-green-500" />
                            <span className="font-medium text-neutral-900">
                              Claim #C-1025
                            </span>
                          </div>
                          <p className="text-neutral-600">
                            7-day verification window standard
                          </p>
                        </div>
                        <div className="text-sm">
                          <div className="mb-1 flex items-center gap-2">
                            <div className="h-2 w-2 rounded-full bg-amber-500" />
                            <span className="font-medium text-neutral-900">
                              Claim #C-1026
                            </span>
                          </div>
                          <p className="text-neutral-600">
                            Chain of custody requirements (under review)
                          </p>
                        </div>
                      </div>
                    </Card>

                    <Card className="border border-neutral-200 p-6">
                      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                        Related Artifacts
                      </h3>
                      <div className="space-y-3">
                        <Link
                          to={`/dossier/${dossierId}/artifact/voting-systems`}
                          className="block text-sm text-neutral-600 hover:text-neutral-900"
                        >
                          <div className="flex items-start gap-2">
                            <ExternalLink className="mt-0.5 h-3 w-3" />
                            <span>Voting Systems (live seed)</span>
                          </div>
                        </Link>
                        <Link
                          to={`/dossier/${dossierId}/artifact/voter-reg`}
                          className="block text-sm text-neutral-600 hover:text-neutral-900"
                        >
                          <div className="flex items-start gap-2">
                            <ExternalLink className="mt-0.5 h-3 w-3" />
                            <span>Voter Registration Procedures</span>
                          </div>
                        </Link>
                        <Link
                          to={`/dossier/${dossierId}/artifact/polling`}
                          className="block text-sm text-neutral-600 hover:text-neutral-900"
                        >
                          <div className="flex items-start gap-2">
                            <ExternalLink className="mt-0.5 h-3 w-3" />
                            <span>Polling Place Operations</span>
                          </div>
                        </Link>
                      </div>
                    </Card>
                  </>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
