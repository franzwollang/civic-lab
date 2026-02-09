import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { Plate, PlateContent, usePlateEditor } from "platejs/react";
import { v4 as uuidv4 } from "uuid";
import { Editor, Transforms } from "slate";

import { Header } from "../components/header";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Badge } from "../components/ui/badge";
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
  insertCodeBlock,
  insertMermaidBlock,
  insertProcedureBlock,
} from "@/editor/blockCommands";
import { extractBlockIndex } from "@/doc/blockIndex";
import { merkleRoot } from "@/doc/merkle";
import { diffBlocks } from "@/doc/diff";
import type { PageRevisionRow, PageRow } from "@/doc/types";
import { createRevision, getPage, getRevisions, updatePage } from "@/api/client";
import { validateDocument } from "@/doc/validation";

const PAGE_ID = "page-001";

export function TestEditor() {
  const [value, setValue] = useState(initialValue);
  const [page, setPage] = useState<PageRow | null>(null);
  const [revisions, setRevisions] = useState<PageRevisionRow[]>([]);
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

  const diffSummary = useMemo(() => {
    if (!latestRevision || !previousRevision) return null;
    return diffBlocks(previousRevision.blocks, latestRevision.blocks);
  }, [latestRevision, previousRevision]);

  const validation = useMemo(
    () => validateDocument(value),
    [mathjaxTick, mermaidTick, value],
  );

  const load = async () => {
    setStatus("loading");
    setError(null);
    try {
      const [pageData, revisionsData] = await Promise.all([
        getPage(PAGE_ID),
        getRevisions(PAGE_ID),
      ]);
      setPage(pageData);
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
  }, []);

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

      const revision: PageRevisionRow = {
        revision_id: revisionId,
        page_id: page.page_id,
        parent_revision_id: page.current_revision_id,
        created_at: new Date().toISOString(),
        author: "local",
        content_json: nextValue,
        blocks,
        doc_root_hash: docRootHash,
        schema_version: 2,
      };

      await createRevision(page.page_id, revision);
      const updated = await updatePage(page.page_id, {
        current_revision_id: revisionId,
      });
      setPage(updated);

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

  return (
    <div className="min-h-screen bg-neutral-50">
      <Header />

      <main className="mx-auto flex h-[calc(100vh-4rem)] max-w-[1400px] min-h-0 gap-6 px-8 py-6 overflow-hidden">
        <aside className="flex w-1/4 min-h-0 flex-col gap-6">
          <div className="pb-4">
            <h1 className="text-3xl font-semibold text-neutral-900">
              Test Editor
            </h1>
            <p className="text-sm text-neutral-500">
              MVP Plate editor with block hashes and revision tracking.
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
            <div className="border-b border-neutral-200 bg-white px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-neutral-500">
                    Editing
                  </div>
                  <div className="text-lg font-semibold text-neutral-900">
                    {page?.title || "Voting Systems"}
                  </div>
                </div>
                <Badge variant="secondary">
                  {page?.current_revision_id ? "Revisions" : "Draft"}
                </Badge>
              </div>
            </div>

            <div className="border-b border-neutral-200 bg-white px-6 py-3">
              <div className="flex flex-wrap items-center gap-4">
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
                  <Button
                    variant={isMarkActive("code") ? "default" : "outline"}
                    size="sm"
                    onMouseDown={(event) => {
                      event.preventDefault();
                      toggleMark("code");
                    }}
                  >
                    Code
                  </Button>
                  <div className="mx-1 h-5 w-px bg-neutral-200" />
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
                </div>
                <div className="h-5 w-px bg-neutral-200" />
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
                      insertCodeBlock(editor, "json");
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
                        handleMathInlineArrowNavigation(editor, event);
                      }}
                      onPaste={(event) => {
                        if (!editor) return;
                        const raw = event.clipboardData?.getData("text/plain");
                        if (!raw) return;

                        const text = raw.replace(/\r\n/g, "\n");
                        const match = text.match(
                          /^```([A-Za-z0-9_-]+)\\s*\\n([\\s\\S]*?)\\n```\\s*$/m,
                        );
                        if (!match) return;

                        const lang = match[1].toLowerCase();
                        const code = match[2] ?? "";

                        if (lang === "mermaid") {
                          event.preventDefault();
                          insertMermaidBlock(editor, code);
                          return;
                        }

                        const normalizedLang = lang === "yml" ? "yaml" : lang;
                        if (
                          normalizedLang === "json" ||
                          normalizedLang === "yaml" ||
                          normalizedLang === "toml" ||
                          normalizedLang === "csv"
                        ) {
                          event.preventDefault();
                          insertCodeBlock(editor, normalizedLang, code);
                        }
                      }}
                    />
                  </Plate>
                </CollapseProvider>
              </div>
            </div>

            <div className="border-t border-neutral-200 bg-white px-6 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  {validation.issues.length > 0 ? (
                    <span className="font-medium text-red-600">
                      {validation.issues[0].message}
                    </span>
                  ) : (
                    <span className="font-medium text-neutral-500">
                      No validation issues.
                    </span>
                  )}
                  {status === "saving" && <span>Saving in progress...</span>}
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    to={`/test/preview/${page?.page_id ?? PAGE_ID}`}
                    className="text-sm font-medium text-neutral-600 hover:text-neutral-900"
                  >
                    Preview
                  </Link>
                  <Button
                    onClick={handleSave}
                    disabled={status === "saving" || validation.issues.length > 0}
                  >
                    {status === "saving" ? "Saving..." : "Save revision"}
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
