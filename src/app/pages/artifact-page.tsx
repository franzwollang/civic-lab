import { useEffect, useMemo, useState } from "react";
import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { LaneBadge } from "../components/badges";
import { Card } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ExternalLink, MessageSquare, GitBranch, Info, Pencil, Shield, Undo2 } from "lucide-react";
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
import { artifactIdOf } from "@/doc/types";
import type { ArtifactRow, DossierRow, ThreadRow } from "@/doc/types";
import {
  getDossier,
  getDossierArtifacts,
  getDossierThreads,
  revertCanonArtifact,
} from "@/api/client";
import { ArtifactClaimsPanel } from "../components/artifact-claims-panel";
import { ObjectBreadcrumbs } from "../components/object-breadcrumbs";
import { laneForDossier, laneLabelForArtifact } from "../lib/dossier-display";
import {
  areaKindFromCollection,
  buildHierarchyCrumbs,
} from "../lib/object-nav";
import { useActingUser } from "../lib/acting-user";
import { userHasCapability } from "../lib/role-affordances";
import { ABOUT_ARTIFACT_ID } from "@/lib/about";
import { FAQ_ARTIFACT_ID } from "@/lib/faq";
import { CHARTER_ARTIFACT_ID } from "@/lib/charter";

function threadTargetsArtifact(thread: ThreadRow, id: string): boolean {
  if (thread.merge_artifact_id === id) return true;
  return (thread.targets ?? []).some(
    (t) => t.target_kind === "artifact" && t.target_id === id,
  );
}

export function ArtifactPage() {
  const { dossierId, artifactId } = useParams();
  const doc = useArtifactDocument(artifactId);
  const { user } = useActingUser();
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [related, setRelated] = useState<ArtifactRow[]>([]);
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [revertBusy, setRevertBusy] = useState(false);
  const [revertError, setRevertError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadRelated() {
      if (!dossierId) {
        setDossier(null);
        setRelated([]);
        setThreads([]);
        return;
      }
      try {
        const [d, artifacts, dossierThreads] = await Promise.all([
          getDossier(dossierId),
          getDossierArtifacts(dossierId),
          getDossierThreads(dossierId),
        ]);
        if (!cancelled) {
          setDossier(d);
          setRelated(artifacts);
          setThreads(dossierThreads);
        }
      } catch {
        if (!cancelled) {
          setDossier(null);
          setRelated([]);
          setThreads([]);
        }
      }
    }
    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [dossierId]);

  const title = useMemo(() => {
    if (doc.status === "ready") return doc.artifact.title;
    return artifactId ?? "Artifact";
  }, [doc, artifactId]);

  const updatedLabel = useMemo(() => {
    if (doc.status === "ready") {
      const d = new Date(doc.revision.created_at);
      return `Revision ${doc.revision.revision_id.slice(0, 8)} · ${d.toLocaleDateString()}`;
    }
    return null;
  }, [doc]);

  const showLive = doc.status === "ready";
  const artifactLane =
    doc.status === "ready"
      ? laneLabelForArtifact(doc.artifact.lane)
      : null;
  const lane =
    artifactLane ?? (dossier ? laneForDossier(dossier) : null);
  const softLabel =
    doc.status === "ready" && doc.artifact.lane_soft_label === "composite"
      ? "composite"
      : null;
  const ownerMergeOnly =
    doc.status === "ready" && Boolean(doc.artifact.owner_merge_only);
  const canEditRestricted = userHasCapability(user, "merge_canon_restricted");
  const canRevertCanon = userHasCapability(user, "revert_canon");
  const showEdit =
    showLive && (!ownerMergeOnly || canEditRestricted);
  const isCanonArea =
    (dossier?.area_kind ??
      (dossier ? areaKindFromCollection(dossier) : null)) === "canon";
  const canShowRevert =
    showLive &&
    isCanonArea &&
    canRevertCanon &&
    Boolean(doc.status === "ready" && doc.revision.parent_revision_id);
  const livingSiteArtifactLabel =
    doc.status === "ready"
      ? artifactIdOf(doc.artifact) === CHARTER_ARTIFACT_ID
        ? " · living Charter"
        : artifactIdOf(doc.artifact) === ABOUT_ARTIFACT_ID
          ? " · living About"
          : artifactIdOf(doc.artifact) === FAQ_ARTIFACT_ID
            ? " · living FAQ"
            : ""
      : "";

  const relatedFiltered = useMemo(() => {
    const currentSlug =
      doc.status === "ready" ? doc.artifact.slug : artifactId;
    const currentId =
      doc.status === "ready" ? artifactIdOf(doc.artifact) : artifactId;
    return related.filter((r) => {
      const id = artifactIdOf(r);
      return r.slug !== currentSlug && id !== currentId;
    });
  }, [related, doc, artifactId]);

  const crumbs = useMemo(() => {
    if (!dossier || !dossierId) return [];
    const area_kind =
      dossier.area_kind ?? areaKindFromCollection(dossier);
    return buildHierarchyCrumbs({
      area_kind,
      collection_id: dossier.collection_id,
      collection_title: dossier.collection_title ?? "Collection",
      dossier_id: dossier.dossier_id,
      dossier_title: dossier.title,
      leaf: [{ label: title }],
    });
  }, [dossier, dossierId, title]);

  const currentArtifactId =
    doc.status === "ready" ? artifactIdOf(doc.artifact) : artifactId;
  const isCharter =
    doc.status === "ready" &&
    artifactIdOf(doc.artifact) === CHARTER_ARTIFACT_ID;

  const relatedThreads = useMemo(() => {
    if (!currentArtifactId) return [];
    return threads.filter((t) =>
      threadTargetsArtifact(t, currentArtifactId),
    );
  }, [threads, currentArtifactId]);

  const discussThread =
    relatedThreads.find((t) => t.state === "open") ?? relatedThreads[0] ?? null;
  const rfcThread =
    relatedThreads.find(
      (t) => t.state === "rfc" || t.state === "review",
    ) ??
    relatedThreads.find((t) => t.state === "decided") ??
    null;

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      <SidebarNav
        dossierId={dossierId}
        collectionId={dossier?.collection_id}
        currentPage="artifact"
      />

      <main className="ml-64 pt-16">
        <div className="mx-auto max-w-[1200px] px-8 py-8">
          <div className="flex gap-8">
            <article className="flex-1">
              <div className="mb-6">
                {crumbs.length > 0 ? (
                  <ObjectBreadcrumbs crumbs={crumbs} />
                ) : dossierId ? (
                  <div className="mb-2 text-sm text-neutral-500">
                    <Link
                      to={`/dossier/${dossierId}`}
                      className="hover:text-neutral-700"
                    >
                      ↑ Dossier
                    </Link>{" "}
                    / Artifact
                  </div>
                ) : null}
                <div className="mb-4 flex items-center gap-3">
                  {lane && (
                    <>
                      <LaneBadge lane={lane} />
                      {softLabel === "composite" && (
                        <Badge
                          variant="outline"
                          className="border border-amber-200 bg-amber-50 text-xs font-medium text-amber-800"
                        >
                          Composite
                        </Badge>
                      )}
                      {lane === "Prescriptive" && (
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
                      )}
                    </>
                  )}
                  {showLive && (
                    <Badge variant="secondary">Live revision</Badge>
                  )}
                  {ownerMergeOnly && (
                    <Badge
                      variant="outline"
                      className="border border-neutral-400 bg-neutral-100 text-xs font-medium text-neutral-800"
                    >
                      <Shield className="mr-1 h-3 w-3" />
                      {isCharter ? "Charter · Owner merge only" : "Owner merge only"}
                    </Badge>
                  )}
                </div>
                <h1 className="mb-4 text-3xl font-bold text-neutral-900">
                  {title}
                </h1>
                {updatedLabel && (
                  <div className="flex items-center gap-4 text-sm text-neutral-600">
                    <span>{updatedLabel}</span>
                    {showLive && (
                      <>
                        <span>·</span>
                        <span>Author: {doc.revision.author}</span>
                        <span>·</span>
                        <Link
                          to={`/test/preview/${artifactIdOf(doc.artifact)}`}
                          className="text-neutral-700 underline-offset-2 hover:underline"
                        >
                          Open test preview
                        </Link>
                      </>
                    )}
                  </div>
                )}
              </div>

              {showLive && (
                <div className="mb-8 flex flex-wrap items-center gap-3">
                  {showEdit ? (
                    <Link
                      to={`/dossier/${dossierId}/artifact/${artifactIdOf(doc.artifact)}/edit`}
                    >
                      <Button variant="default" size="sm">
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </Button>
                    </Link>
                  ) : ownerMergeOnly ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span>
                            <Button variant="outline" size="sm" disabled>
                              <Shield className="mr-2 h-4 w-4" />
                              Owner edit only
                            </Button>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            Restricted Canon (`owner_merge_only`). Switch to an
                            Owner persona to open the editor; merges still go
                            through leaf RFC + Owner decide.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                  {canShowRevert && doc.status === "ready" ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={revertBusy}
                            data-testid="canon-revert-button"
                            onClick={() => {
                              const id = artifactIdOf(doc.artifact);
                              const parent = doc.revision.parent_revision_id;
                              if (!parent) return;
                              const ok = window.confirm(
                                `Revert this Canon artifact to prior revision ${parent.slice(0, 8)}…? This is audit-logged (CONCEPT §9.3).`,
                              );
                              if (!ok) return;
                              setRevertBusy(true);
                              setRevertError(null);
                              void revertCanonArtifact(id, {
                                actor_id: user.id,
                              })
                                .then(() => {
                                  window.location.reload();
                                })
                                .catch((err: unknown) => {
                                  setRevertBusy(false);
                                  setRevertError(
                                    err instanceof Error
                                      ? err.message
                                      : "Revert failed",
                                  );
                                });
                            }}
                          >
                            <Undo2 className="mr-2 h-4 w-4" />
                            {revertBusy ? "Reverting…" : "Revert"}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            Owner-only Canon revert to the previous revision.
                            Append-only audit; revisions are never deleted.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : null}
                  {revertError ? (
                    <span className="text-xs text-amber-800">{revertError}</span>
                  ) : null}
                  {discussThread ? (
                    <Link to={`/thread/${discussThread.thread_id}`}>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Open Thread
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/dossier/${dossierId}`}>
                      <Button variant="outline" size="sm">
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Dossier threads
                      </Button>
                    </Link>
                  )}
                  {rfcThread ? (
                    <Link to={`/thread/${rfcThread.thread_id}/rfc`}>
                      <Button variant="outline" size="sm">
                        <GitBranch className="mr-2 h-4 w-4" />
                        Open RFC
                      </Button>
                    </Link>
                  ) : discussThread ? (
                    <Link to={`/thread/${discussThread.thread_id}`}>
                      <Button variant="outline" size="sm">
                        <GitBranch className="mr-2 h-4 w-4" />
                        Promote on thread
                      </Button>
                    </Link>
                  ) : (
                    <Link to={`/dossier/${dossierId}`}>
                      <Button variant="outline" size="sm">
                        <GitBranch className="mr-2 h-4 w-4" />
                        Dossier RFCs
                      </Button>
                    </Link>
                  )}
                </div>
              )}

              {doc.status === "loading" && (
                <Card className="border border-neutral-200 bg-white p-8 text-sm text-neutral-500">
                  Loading artifact document…
                </Card>
              )}

              {doc.status === "error" && (
                <Card className="border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
                  Could not load artifact ({doc.message}).
                </Card>
              )}

              {doc.status === "missing" && (
                <Card className="border border-neutral-200 bg-white p-6">
                  <h2 className="mb-2 text-lg font-semibold text-neutral-900">
                    Artifact not found
                  </h2>
                  <p className="mb-4 text-sm text-neutral-600">
                    No seeded artifact matches <code>{artifactId}</code> in this
                    dossier.
                  </p>
                  <Link
                    to={`/dossier/${dossierId}`}
                    className="text-sm underline"
                  >
                    Back to dossier
                  </Link>
                </Card>
              )}

              {doc.status === "ready" && (
                <Card className="border border-neutral-200 bg-white p-8">
                  <ArtifactDocumentBody load={doc} />
                </Card>
              )}

              {doc.status === "ready" && (
                <div className="mt-8">
                  <ArtifactClaimsPanel
                    artifact={doc.artifact}
                    dossier={dossier}
                    sections={doc.sections}
                  />
                </div>
              )}
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
                        {showLive ? artifactIdOf(doc.artifact) : artifactId}
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
                    {ownerMergeOnly && (
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Merge gate
                        </div>
                        <div className="text-neutral-600">
                          Owner only (`owner_merge_only`)
                          {livingSiteArtifactLabel}
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
                        {dossier?.title ?? dossierId}
                      </Link>
                    </div>
                    {showLive && (
                      <div>
                        <div className="mb-1 font-medium text-neutral-900">
                          Version
                        </div>
                        <div className="text-neutral-600">
                          {doc.revision.revision_id.slice(0, 8)}
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
                      Stable keys from heading block ids; Prisma Section rows
                      sync on save (`GET /api/artifacts/:id/sections`).
                    </p>
                  </Card>
                )}

                {relatedFiltered.length > 0 && (
                  <Card className="border border-neutral-200 p-6">
                    <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-700">
                      Related Artifacts
                    </h3>
                    <div className="space-y-3">
                      {relatedFiltered.map((r) => (
                        <Link
                          key={artifactIdOf(r)}
                          to={`/dossier/${dossierId}/artifact/${r.slug}`}
                          className="block text-sm text-neutral-600 hover:text-neutral-900"
                        >
                          <div className="flex items-start gap-2">
                            <ExternalLink className="mt-0.5 h-3 w-3" />
                            <span>{r.title}</span>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </Card>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  );
}
