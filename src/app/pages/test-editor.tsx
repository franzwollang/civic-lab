import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { v4 as uuidv4 } from "uuid";
import { Editor, Range, Transforms } from "slate";

import { Header } from "../components/header";
import { SidebarNav } from "../components/sidebar-nav";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Separator } from "../components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../components/ui/tooltip";

import { CollapseProvider, editorPlugins, initialValue } from "@/editor/plate";
import {
  ensureMathJaxLoaded,
  subscribeMathJaxUpdates,
} from "@/editor/mathjax";
import { subscribeMermaidUpdates } from "@/editor/mermaid";
import { normalizeDocumentValue } from "@/editor/model";
import { normalizeHeadingLevels } from "@/editor/normalize";
import { autoConvertMath } from "@/editor/autoConvertMath";
import { handleMathInlineArrowNavigation } from "@/editor/mathNavigation";
import { insertMathBlock, insertMathInline } from "@/editor/mathCommands";
import { TAB_SPACES } from "@/editor/tabSpaces";
import {
  insertDataBlock,
  insertExternalArtifact,
  insertImageBlock,
  insertMermaidBlock,
  insertProcedureBlock,
} from "@/editor/blockCommands";
import {
  insertCitationInline,
  insertEvidenceBlock,
  insertTermInline,
} from "@/editor/evidenceCommands";
import {
  isBulletedListActive,
  isNumberedListActive,
  promptUpsertLink,
  toggleBulletedList,
  toggleNumberedList,
} from "@/editor/listLinkCommands";
import {
  isBlockquoteActive,
  toggleBlockquote,
} from "@/editor/blockquoteCommands";
import type { AttributionEntity, TermEntity } from "@/doc/evidence";
import {
  AttributionEditorDialog,
  AttributionSearchDialog,
} from "@/app/components/evidence/attribution-dialogs";
import {
  TermEditorDialog,
  TermSearchDialog,
} from "@/app/components/evidence/term-dialogs";
import { resolveDefaultTermScope } from "@/lib/termScope";
import {
  EvidenceRegistryProvider,
  useEvidenceRegistry,
} from "@/editor/evidenceRegistry";
import { EvidenceModalProvider } from "@/editor/evidenceModals";
import { extractBlockIndex } from "@/doc/blockIndex";
import { merkleRoot } from "@/doc/merkle";
import { diffBlocks } from "@/doc/diff";
import type { ArtifactRevisionRow, ArtifactRow, DossierRow } from "@/doc/types";
import { artifactIdOf } from "@/doc/types";
import { getArtifact, getArtifactRevisions, getDossier } from "@/api/client";
import { saveRevision, toUserMessage } from "@/api/actions";
import { validateDocument } from "@/doc/validation";
import { ObjectBreadcrumbs } from "../components/object-breadcrumbs";
import {
  areaKindFromCollection,
  buildHierarchyCrumbs,
} from "../lib/object-nav";
import { useActingUserOptional } from "../lib/acting-user";
import { userHasCapability } from "../lib/role-affordances";

const DEFAULT_ARTIFACT_ID = "page-001";

export function TestEditor() {
  return (
    <EvidenceRegistryProvider>
      <TestEditorInner />
    </EvidenceRegistryProvider>
  );
}

/** Product-chrome alias — same Plate editor under dossier routes. */
export const ArtifactEditorPage = TestEditor;

function TestEditorInner() {
  const { artifactId: artifactIdParam, dossierId } = useParams();
  const artifactId = artifactIdParam || DEFAULT_ARTIFACT_ID;
  const inProductChrome = Boolean(dossierId);
  const artifactViewPath = dossierId
    ? `/dossier/${dossierId}/artifact/${artifactId}`
    : `/test/preview/${artifactId}`;
  const [value, setValue] = useState(initialValue);
  const [page, setPage] = useState<ArtifactRow | null>(null);
  const [dossier, setDossier] = useState<DossierRow | null>(null);
  const [revisions, setRevisions] = useState<ArtifactRevisionRow[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const [mathjaxTick, setMathjaxTick] = useState(0);
  const [mermaidTick, setMermaidTick] = useState(0);
  const isAutoConvertingMath = useRef(false);
  const [collapsedHeaderIds, setCollapsedHeaderIds] = useState<Set<string>>(
    () => new Set(),
  );
  const hasInitializedCollapse = useRef(false);
  const evidenceRegistry = useEvidenceRegistry();
  const acting = useActingUserOptional();

  const savedSelectionForInsert = useRef<Range | null>(null);

  const [termSearchOpen, setTermSearchOpen] = useState(false);
  const [termEditorOpen, setTermEditorOpen] = useState(false);
  const [termSeed, setTermSeed] = useState("");
  const [termEditing, setTermEditing] = useState<TermEntity | null>(null);
  const termEditorPurpose = useRef<"insert" | "search">("insert");

  const [attSearchOpen, setAttSearchOpen] = useState(false);
  const [attEditorOpen, setAttEditorOpen] = useState(false);
  const [attSeed, setAttSeed] = useState("");
  const [attEditing, setAttEditing] = useState<AttributionEntity | null>(null);
  const attEditorPurpose = useRef<"insert" | "search">("insert");
  const attSelectionHandler = useRef<((id: string) => void) | null>(null);

  const getBlockId = (node: Record<string, unknown>) => {
    const id = (node as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  };

  const getHeaderLevel = (node: Record<string, unknown>) => {
    const type = (node as { type?: unknown }).type;
    if (type === "h2") return 2;
    if (type === "h3") return 3;
    if (type === "h4") return 4;
    return null;
  };

  const editor = usePlateEditor({
    plugins: editorPlugins,
    value: initialValue,
  });

  const isMarkActive = (mark: string) => {
    if (!editor) return false;
    try {
      const marks = Editor.marks(editor);
      return marks ? marks[mark] === true : false;
    } catch {
      // Slate can throw if selection is temporarily inconsistent during custom element interactions.
      return false;
    }
  };

  const toggleMark = (mark: string) => {
    if (!editor) return;
    if (isMarkActive(mark)) {
      Editor.removeMark(editor, mark);
    } else {
      Editor.addMark(editor, mark, true);
    }
  };

  const setBlockType = (type: string) => {
    if (!editor) return;
    Transforms.setNodes(
      editor,
      { type },
      {
        match: (node) => Editor.isBlock(editor, node),
      },
    );
  };

  const renderLeaf = ({ attributes, children, leaf }: any) => {
    let next = children;
    if (leaf.bold) next = <strong>{next}</strong>;
    if (leaf.italic) next = <em>{next}</em>;
    if (leaf.underline) next = <u>{next}</u>;
    if (leaf.code) {
      next = (
        <code className="rounded bg-neutral-100 px-1 py-0.5 text-[0.85em]">
          {next}
        </code>
      );
    }
    return <span {...attributes}>{next}</span>;
  };

  const latestRevision = revisions[0];
  const previousRevision = revisions[1];
  const ownerMergeOnly = Boolean(page?.owner_merge_only);
  const canEditRestricted = userHasCapability(
    acting.user,
    "merge_canon_restricted",
  );
  const saveBlocked =
    inProductChrome && ownerMergeOnly && !canEditRestricted;

  const diffSummary = useMemo(() => {
    if (!latestRevision || !previousRevision) return null;
    return diffBlocks(previousRevision.blocks, latestRevision.blocks);
  }, [latestRevision, previousRevision]);

  const validation = useMemo(() => {
    const useRegistry =
      !evidenceRegistry.loading && !evidenceRegistry.error;
    const attributionIds = useRegistry
      ? new Set(
          evidenceRegistry.attributions.items.map((item) => item.id),
        )
      : undefined;
    const termIds = useRegistry
      ? new Map(
          evidenceRegistry.terms.items.map((item) => [
            item.id,
            { status: item.status as string | undefined },
          ]),
        )
      : undefined;
    return validateDocument(value, {
      registry: useRegistry
        ? { attributions: attributionIds, terms: termIds }
        : undefined,
    });
  }, [
    evidenceRegistry.attributions.items,
    evidenceRegistry.error,
    evidenceRegistry.loading,
    evidenceRegistry.terms.items,
    mathjaxTick,
    mermaidTick,
    value,
  ]);
  const errorIssues = validation.issues.filter(
    (issue) => issue.severity === "error",
  );
  const warningIssues = validation.issues.filter(
    (issue) => issue.severity === "warning",
  );
  const primaryIssue = errorIssues[0] ?? warningIssues[0];
  const hasErrors = errorIssues.length > 0;

  const load = async () => {
    setStatus("loading");
    setError(null);
    try {
      const [pageData, revisionsData, dossierData] = await Promise.all([
        getArtifact(artifactId),
        getArtifactRevisions(artifactId),
        dossierId ? getDossier(dossierId) : Promise.resolve(null),
      ]);
      setPage(pageData);
      setDossier(dossierData);
      setRevisions(revisionsData);

      const currentRevision =
        revisionsData.find(
          (revision) => revision.revision_id === pageData.current_revision_id,
        ) || revisionsData[0];

      const rawValue =
        (currentRevision?.content_json as Array<Record<string, unknown>>) ||
        (initialValue as Array<Record<string, unknown>>);
      const normalizedDoc = normalizeDocumentValue(rawValue);
      const normalizedHeadings = normalizeHeadingLevels(normalizedDoc.value);
      const nextValue = normalizedHeadings.value;
      setValue(nextValue);
      editor?.tf?.setValue(nextValue as Array<Record<string, unknown>>);
      if (!hasInitializedCollapse.current) {
        const nextCollapsed = new Set(
          nextValue
            .filter((node) => getHeaderLevel(node) !== null)
            .map((node) => getBlockId(node))
            .filter((id): id is string => Boolean(id)),
        );
        setCollapsedHeaderIds(nextCollapsed);
        hasInitializedCollapse.current = true;
      }
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load page");
      setStatus("error");
    }
  };

  useEffect(() => {
    void load();
  }, [artifactId]);

  useEffect(() => {
    void ensureMathJaxLoaded();
    const unsubscribe = subscribeMathJaxUpdates(() =>
      setMathjaxTick((tick) => tick + 1),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = subscribeMermaidUpdates(() =>
      setMermaidTick((tick) => tick + 1),
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!editor) return;
    if (isAutoConvertingMath.current) return;
    isAutoConvertingMath.current = true;
    try {
      autoConvertMath(editor);
    } finally {
      isAutoConvertingMath.current = false;
    }
  }, [editor, mathjaxTick, value]);

  useEffect(() => {
    if (hasInitializedCollapse.current) return;
    if (collapsedHeaderIds.size > 0) return;
    const initialCollapsed = new Set(
      value
        .filter((node) => getHeaderLevel(node) !== null)
        .map((node) => getBlockId(node))
        .filter((id): id is string => Boolean(id)),
    );
    if (initialCollapsed.size > 0) {
      setCollapsedHeaderIds(initialCollapsed);
    }
  }, [collapsedHeaderIds.size, value]);

  const handleSave = async () => {
    if (!page) return;
    if (saveBlocked) {
      setError(
        "Restricted Canon (`owner_merge_only`) — switch to an Owner persona to save.",
      );
      return;
    }
    setStatus("saving");
    setError(null);

    try {
      const normalizedDoc = normalizeDocumentValue(
        value as Array<Record<string, unknown>>,
      );
      const normalizedHeadings = normalizeHeadingLevels(normalizedDoc.value);
      const nextValue = normalizedHeadings.value;
      setValue(nextValue);
      editor?.tf?.setValue(nextValue as Array<Record<string, unknown>>);

      const blocks = extractBlockIndex(nextValue);
      const docRootHash = merkleRoot(blocks.map((block) => block.hash));
      const revisionId = uuidv4();

      const id = artifactIdOf(page);
      const revision: ArtifactRevisionRow = {
        revision_id: revisionId,
        artifact_id: id,
        page_id: id,
        parent_revision_id: page.current_revision_id,
        created_at: new Date().toISOString(),
        author: "local",
        content_json: nextValue,
        blocks,
        doc_root_hash: docRootHash,
        schema_version: 2,
      };

      const result = await saveRevision({
        artifactId: id,
        pageId: id,
        revision,
        nextCurrentRevisionId: revisionId,
      });

      if (!result.ok) {
        setError(toUserMessage(result.error));
        setStatus("error");
        return;
      }

      setPage(result.data);
      await load();
      setStatus("idle");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save revision");
      setStatus("error");
    }
  };

  const toggleCollapsed = (id: string) => {
    setCollapsedHeaderIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const hiddenBlockIds = useMemo(() => {
    const hidden = new Set<string>();
    let activeCollapsedLevel: number | null = null;

    for (const node of value as Array<Record<string, unknown>>) {
      const level = getHeaderLevel(node);
      const id = getBlockId(node);

      if (level !== null) {
        if (activeCollapsedLevel !== null && level <= activeCollapsedLevel) {
          activeCollapsedLevel = null;
        }

        const isCollapsedHeader =
          id !== null && collapsedHeaderIds.has(id);

        if (activeCollapsedLevel !== null && level > activeCollapsedLevel) {
          if (id) hidden.add(id);
          continue;
        }

        if (isCollapsedHeader) {
          activeCollapsedLevel = level;
        }

        continue;
      }

      if (activeCollapsedLevel !== null && id) {
        hidden.add(id);
      }
    }

    return hidden;
  }, [collapsedHeaderIds, value]);

  const restoreSavedSelection = () => {
    if (!editor) return;
    const sel = savedSelectionForInsert.current;
    if (sel) {
      try {
        Transforms.select(editor, sel);
      } catch {
        // ignore
      }
    }
  };

  const openAttributionSearch = (options: {
    seed?: string;
    onSelect: (id: string) => void;
  }) => {
    attSelectionHandler.current = options.onSelect;
    attEditorPurpose.current = "search";
    setAttSeed(options.seed ?? "");
    setAttEditing(null);
    setAttSearchOpen(true);
  };

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />
      {inProductChrome && (
        <SidebarNav dossierId={dossierId} currentPage="artifact" />
      )}

      <TermSearchDialog
        open={termSearchOpen}
        onOpenChange={setTermSearchOpen}
        initialQuery={termSeed}
        onSelectTermId={(termId) => {
          setTermSearchOpen(false);
          if (!editor) return;
          restoreSavedSelection();
          const label =
            evidenceRegistry.terms.items.find((item) => item.id === termId)
              ?.canonical_label_en ?? "";
          insertTermInline(editor, termId, label);
          savedSelectionForInsert.current = null;
        }}
        onProposeNew={(seedLabel) => {
          setTermSearchOpen(false);
          termEditorPurpose.current = "insert";
          setTermSeed(seedLabel);
          setTermEditing(null);
          setTermEditorOpen(true);
        }}
        onEditTerm={(term) => {
          setTermSearchOpen(false);
          termEditorPurpose.current = "search";
          setTermEditing(term);
          setTermEditorOpen(true);
        }}
      />

      <TermEditorDialog
        open={termEditorOpen}
        onOpenChange={setTermEditorOpen}
        seedLabel={termSeed}
        editing={termEditing}
        defaultScope={resolveDefaultTermScope({
          dossierId: inProductChrome ? dossierId : null,
          countryCode: dossier?.country_code ?? null,
        })}
        onSaved={(termId) => {
          if (termEditorPurpose.current !== "insert") {
            // Return to search, don't insert.
            setTermSearchOpen(true);
            return;
          }
          if (!editor) return;
          restoreSavedSelection();
          const label =
            evidenceRegistry.terms.items.find((item) => item.id === termId)
              ?.canonical_label_en ?? "";
          insertTermInline(editor, termId, label);
          savedSelectionForInsert.current = null;
        }}
      />

      <AttributionSearchDialog
        open={attSearchOpen}
        onOpenChange={(open) => {
          setAttSearchOpen(open);
          if (!open) {
            attSelectionHandler.current = null;
          }
        }}
        initialQuery={attSeed}
        onSelectAttributionId={(id) => {
          setAttSearchOpen(false);
          const handler = attSelectionHandler.current;
          attSelectionHandler.current = null;
          if (handler) {
            handler(id);
            return;
          }
          if (!editor) return;
          restoreSavedSelection();
          if (editor.selection && Range.isExpanded(editor.selection)) {
            Transforms.collapse(editor, { edge: "end" });
          }
          insertCitationInline(editor, id);
          savedSelectionForInsert.current = null;
        }}
        onCreateNew={(seed) => {
          setAttSearchOpen(false);
          attEditorPurpose.current = attSelectionHandler.current ? "search" : "insert";
          setAttSeed(seed);
          setAttEditing(null);
          setAttEditorOpen(true);
        }}
        onEditAttribution={(att) => {
          setAttSearchOpen(false);
          attEditorPurpose.current = "search";
          setAttEditing(att);
          setAttEditorOpen(true);
        }}
      />

      <AttributionEditorDialog
        open={attEditorOpen}
        onOpenChange={setAttEditorOpen}
        seed={attSeed}
        editing={attEditing}
        onSaved={(id) => {
          const handler = attSelectionHandler.current;
          if (handler) {
            attSelectionHandler.current = null;
            handler(id);
            return;
          }
          if (attEditorPurpose.current !== "insert") {
            setAttSearchOpen(true);
            return;
          }
          if (!editor) return;
          restoreSavedSelection();
          if (editor.selection && Range.isExpanded(editor.selection)) {
            Transforms.collapse(editor, { edge: "end" });
          }
          insertCitationInline(editor, id);
          savedSelectionForInsert.current = null;
        }}
      />

      <main
        className={
          "mx-auto flex h-[calc(100vh-4rem)] max-w-[1400px] min-h-0 gap-6 px-8 py-6 overflow-hidden " +
          (inProductChrome ? "ml-64" : "")
        }
      >
        <aside className="flex w-1/4 min-h-0 flex-col gap-6">
          <div className="pb-4">
            {inProductChrome && dossier && dossierId && (
              <ObjectBreadcrumbs
                crumbs={buildHierarchyCrumbs({
                  area_kind:
                    dossier.area_kind ?? areaKindFromCollection(dossier),
                  collection_id: dossier.collection_id,
                  collection_title: dossier.collection_title ?? "Collection",
                  dossier_id: dossier.dossier_id,
                  dossier_title: dossier.title,
                  leaf: [
                    {
                      label: page?.title || "Artifact",
                      href: artifactViewPath,
                    },
                    { label: "Edit" },
                  ],
                })}
              />
            )}
            {inProductChrome && !dossier && (
              <div className="mb-2 text-sm text-neutral-500">
                <Link
                  to={artifactViewPath}
                  className="hover:text-neutral-700"
                >
                  ← Back to artifact
                </Link>
              </div>
            )}
            <div className="text-xs uppercase tracking-wider text-neutral-500">
              {inProductChrome ? "Product editor" : "Editing"}
            </div>
            <h1 className="text-3xl font-semibold text-neutral-900">
              {page?.title || "Voting Systems"}
            </h1>
            <p className="text-sm text-neutral-500">
              {inProductChrome
                ? "Plate editor in dossier chrome — save writes ArtifactRevision."
                : "MVP Plate editor with block hashes and revision tracking."}
            </p>
          </div>

          {error && (
            <Card className="border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </Card>
          )}

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto pr-4 pb-2">
            <div className="sticky top-0 z-10 bg-neutral-50">
              <div className="border-t-2 border-neutral-200/80" />
            </div>
            <div className="pt-4">
              <Card className="mb-4 border border-neutral-200 bg-white p-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                Latest Revision
              </div>
              {latestRevision ? (
                <div className="space-y-1 text-[11px] leading-4 text-neutral-600">
                  <div className="flex min-w-0 items-start gap-1">
                    <span className="shrink-0 font-medium text-neutral-900">
                      ID:
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="line-clamp-1 min-w-0 flex-1 break-all cursor-help">
                            {latestRevision.revision_id}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[320px] break-all text-xs">
                          {latestRevision.revision_id}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="flex min-w-0 items-start gap-1">
                    <span className="shrink-0 font-medium text-neutral-900">
                      Root:
                    </span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="line-clamp-1 min-w-0 flex-1 break-all cursor-help">
                            {latestRevision.doc_root_hash}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-[320px] break-all text-xs">
                          {latestRevision.doc_root_hash}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div>
                    <span className="font-medium text-neutral-900">Blocks:</span>{" "}
                    {latestRevision.blocks.length}
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500">
                  No revisions yet.
                </div>
              )}

              <div className="my-2 h-px bg-neutral-200" />

              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
                What Changed
              </div>
              {diffSummary ? (
                <div className="text-[11px] leading-4 text-neutral-600">
                  +{diffSummary.added.length} added, -
                  {diffSummary.deleted.length} deleted, ~
                  {diffSummary.edited.length} edited, ↕
                  {diffSummary.moved.length} moved
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500">
                  Create at least two revisions to see a summary.
                </div>
              )}
              </Card>

              <Card className="border border-neutral-200 bg-white p-4">
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                  Revision List
                </div>
                <div className="space-y-2 text-[11px] leading-5 text-neutral-600">
                {revisions.length === 0 && (
                  <div className="text-neutral-500">No revisions yet.</div>
                )}
                {revisions.map((revision, index) => (
                  <div key={revision.revision_id}>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-neutral-900">
                        Revision {revisions.length - index}
                      </span>
                      <span>{new Date(revision.created_at).toLocaleString()}</span>
                    </div>
                    <div className="flex min-w-0 items-start gap-1 text-neutral-500">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="line-clamp-1 min-w-0 flex-1 break-all cursor-help">
                              {revision.revision_id}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="max-w-[320px] break-all text-xs">
                            {revision.revision_id}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {index < revisions.length - 1 && (
                      <Separator className="mt-2" />
                    )}
                  </div>
                ))}
                </div>
              </Card>

            </div>
          </div>
        </aside>

        <Card className="border border-neutral-200 bg-white w-3/4 min-h-0">
          <div className="flex h-full min-h-0 flex-col overflow-hidden">
            <div className="border-b border-neutral-200 bg-white px-6 py-2">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] [&_[data-slot=button]]:h-7 [&_[data-slot=button]]:gap-1 [&_[data-slot=button]]:px-2 [&_[data-slot=button]]:text-[11px]">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                    Text
                  </span>
                  <div className="h-4 w-px bg-neutral-200" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant={isMarkActive("bold") ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        toggleMark("bold");
                      }}
                    >
                      Bold
                    </Button>
                    <Button
                      variant={isMarkActive("italic") ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        toggleMark("italic");
                      }}
                    >
                      Italic
                    </Button>
                    <Button
                      variant={isMarkActive("underline") ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        toggleMark("underline");
                      }}
                    >
                      Underline
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] [&_[data-slot=button]]:h-7 [&_[data-slot=button]]:gap-1 [&_[data-slot=button]]:px-2 [&_[data-slot=button]]:text-[11px]">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                    Blocks
                  </span>
                  <div className="h-4 w-px bg-neutral-200" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setBlockType("p");
                      }}
                    >
                      Paragraph
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setBlockType("h2");
                      }}
                    >
                      H2
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setBlockType("h3");
                      }}
                    >
                      H3
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        setBlockType("h4");
                      }}
                    >
                      H4
                    </Button>
                    <Button
                      variant={isBulletedListActive(editor) ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        toggleBulletedList(editor);
                      }}
                    >
                      Bullets
                    </Button>
                    <Button
                      variant={isNumberedListActive(editor) ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        toggleNumberedList(editor);
                      }}
                    >
                      Numbered
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        promptUpsertLink(editor);
                      }}
                    >
                      Link
                    </Button>
                    <Button
                      variant={isBlockquoteActive(editor) ? "default" : "outline"}
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        toggleBlockquote(editor);
                      }}
                    >
                      Quote
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] [&_[data-slot=button]]:h-7 [&_[data-slot=button]]:gap-1 [&_[data-slot=button]]:px-2 [&_[data-slot=button]]:text-[11px]">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                    Inserts
                  </span>
                  <div className="h-4 w-px bg-neutral-200" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertMathInline(editor);
                      }}
                    >
                      Inline Math
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertMathBlock(editor);
                      }}
                    >
                      Math Block
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertDataBlock(editor, "json");
                      }}
                    >
                      Data
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertMermaidBlock(editor);
                      }}
                    >
                      Diagram
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertProcedureBlock(editor);
                      }}
                    >
                      Procedure
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertImageBlock(editor);
                      }}
                    >
                      Image
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertExternalArtifact(editor);
                      }}
                    >
                      External
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-neutral-200 bg-neutral-50 px-2 py-1 text-[11px] [&_[data-slot=button]]:h-7 [&_[data-slot=button]]:gap-1 [&_[data-slot=button]]:px-2 [&_[data-slot=button]]:text-[11px]">
                  <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-500">
                    Evidence
                  </span>
                  <div className="h-4 w-px bg-neutral-200" />
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        insertEvidenceBlock(editor);
                      }}
                    >
                      Evidence
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        // Open citation search modal (dedupe first).
                        const sel = editor.selection
                          ? (JSON.parse(JSON.stringify(editor.selection)) as Range)
                          : null;
                        savedSelectionForInsert.current = sel;
                        attSelectionHandler.current = null;
                        setAttSeed("");
                        setAttEditing(null);
                        attEditorPurpose.current = "insert";
                        setAttSearchOpen(true);
                      }}
                    >
                      Cite
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        if (!editor) return;
                        // Open term search modal. If text is selected, use it to seed search.
                        const sel = editor.selection
                          ? (JSON.parse(JSON.stringify(editor.selection)) as Range)
                          : null;
                        savedSelectionForInsert.current = sel;
                        const seed =
                          sel && Range.isExpanded(sel)
                            ? Editor.string(editor, sel)
                            : "";
                        setTermSeed(seed);
                        setTermEditing(null);
                        termEditorPurpose.current = "insert";
                        setTermSearchOpen(true);
                      }}
                    >
                      Term
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto px-6 py-4">
                <CollapseProvider
                  value={{
                    collapsedHeaderIds,
                    hiddenBlockIds,
                    toggleCollapse: toggleCollapsed,
                    isCollapsed: (id) => collapsedHeaderIds.has(id),
                    isHidden: (id) => hiddenBlockIds.has(id),
                  }}
                >
                  <EvidenceModalProvider value={{ openAttributionSearch }}>
                    <Plate
                      editor={editor}
                      onChange={({ value: nextValue }) => {
                        const normalizedHeadings = normalizeHeadingLevels(
                          nextValue as Array<Record<string, unknown>>,
                        );
                        const normalizedDoc = normalizeDocumentValue(
                          normalizedHeadings.value as Array<Record<string, unknown>>,
                        );

                        if (normalizedHeadings.changed || normalizedDoc.changed) {
                          setValue(normalizedDoc.value);
                          editor?.tf?.setValue(
                            normalizedDoc.value as Array<Record<string, unknown>>,
                          );
                          return;
                        }
                        setValue(
                          normalizedDoc.value as Array<Record<string, unknown>>,
                        );
                      }}
                    >
                      <PlateContent
                        className="min-h-full rounded-lg border border-neutral-200 bg-white p-4 pb-12 text-sm text-neutral-900 focus:outline-none"
                        placeholder="Write your draft..."
                        renderLeaf={renderLeaf}
                        onKeyDown={(event) => {
                          if (!editor) return;
                          if (
                            event.key === "Tab" &&
                            !event.shiftKey &&
                            !event.metaKey &&
                            !event.ctrlKey &&
                            !event.altKey
                          ) {
                            event.preventDefault();
                            Transforms.insertText(editor, TAB_SPACES);
                            return;
                          }
                          handleMathInlineArrowNavigation(editor, event, {
                            isHidden: (node) => {
                              const id =
                                node &&
                                typeof node === "object" &&
                                "id" in node &&
                                typeof (node as { id?: unknown }).id === "string"
                                  ? (node as { id: string }).id
                                  : undefined;
                              return id ? hiddenBlockIds.has(id) : false;
                            },
                          });
                        }}
                      />
                    </Plate>
                  </EvidenceModalProvider>
                </CollapseProvider>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[11px] text-neutral-500">
                  {primaryIssue ? (
                    <span
                      className={
                        "font-medium " +
                        (hasErrors ? "text-red-600" : "text-amber-600")
                      }
                    >
                      {primaryIssue.message}
                    </span>
                  ) : (
                    <span className="font-medium text-neutral-500">
                      No validation issues.
                    </span>
                  )}
                  {status === "saving" && (
                    <span>Saving in progress...</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to={
                      inProductChrome
                        ? artifactViewPath
                        : `/test/preview/${artifactIdOf(page ?? { page_id: artifactId }) || artifactId}`
                    }
                    className="text-[11px] font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    {inProductChrome ? "Done" : "Preview"}
                  </Link>
                  <Button
                    size="sm"
                    onClick={handleSave}
                    disabled={status === "saving" || hasErrors || saveBlocked}
                    title={
                      saveBlocked
                        ? "Owner persona required for owner_merge_only artifacts"
                        : undefined
                    }
                  >
                    {status === "saving"
                      ? "Saving..."
                      : saveBlocked
                        ? "Owner save only"
                        : "Save revision"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </main>
    </div>
  );
}
