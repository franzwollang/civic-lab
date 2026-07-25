import type { ChangeEvent, KeyboardEvent, MouseEvent } from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement, useSelected } from "platejs/react";
import { createSlatePlugin } from "platejs";
import { Editor, Transforms } from "slate";

import { useCollapseContext } from "@/editor/collapse";
import {
  REMOVE_BUTTON_CLASS,
  VoidPreviewRegion,
  removeButtonKeyDown,
} from "@/editor/voidA11y";
import { handleVoidBlockEdgeArrowExit } from "@/editor/voidNavigation";
import {
  EXTERNAL_ARTIFACT_PROVIDERS,
  formatExternalArtifactLabel,
  isExternalArtifactEmpty,
  validateExternalArtifact,
  type ExternalArtifactProvider,
} from "@/lib/externalArtifact";

type ExternalArtifactElement = {
  type: "external_artifact";
  id?: string;
  provider?: string;
  general_id?: string;
  specific_id?: string;
  display_title?: string;
  summary?: string;
  license?: string;
  children: Array<{ text: string }>;
};

function RemoveButton({
  onMouseDown,
  label,
}: {
  onMouseDown: (e: MouseEvent | KeyboardEvent) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      contentEditable={false}
      onMouseDown={onMouseDown}
      onKeyDown={(e) => removeButtonKeyDown(e, onMouseDown)}
      aria-label={label}
      className={REMOVE_BUTTON_CLASS}
    >
      x
    </button>
  );
}

function useSelectSelf(props: PlateElementProps) {
  return (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    try {
      Transforms.select(
        props.editor,
        Editor.range(props.editor as any, props.path as any) as any,
      );
    } catch {
      // ignore
    }
    document
      .querySelector<HTMLElement>('[data-slate-editor="true"]')
      ?.focus();
  };
}

function useRemoveSelf(
  props: PlateElementProps,
  opts?: { replaceWithParagraph?: boolean; id?: string },
) {
  return (event?: MouseEvent | KeyboardEvent) => {
    event?.preventDefault();
    event?.stopPropagation();
    Transforms.removeNodes(props.editor, { at: props.path });
    if (opts?.replaceWithParagraph) {
      Transforms.insertNodes(
        props.editor,
        {
          type: "p",
          ...(opts.id ? { id: opts.id } : {}),
          children: [{ text: "" }],
        } as any,
        { at: props.path },
      );
    }
  };
}

function ExternalArtifactComponent(props: PlateElementProps) {
  const el = props.element as unknown as ExternalArtifactElement;
  const id = typeof el.id === "string" ? el.id : undefined;
  const collapse = useCollapseContext();
  const hidden = id ? collapse?.isHidden(id) : false;
  const selected = useSelected();
  const selectSelf = useSelectSelf(props);

  const provider = typeof el.provider === "string" ? el.provider : "";
  const generalId = typeof el.general_id === "string" ? el.general_id : "";
  const specificId = typeof el.specific_id === "string" ? el.specific_id : "";
  const displayTitle =
    typeof el.display_title === "string" ? el.display_title : "";
  const summary = typeof el.summary === "string" ? el.summary : "";
  const license = typeof el.license === "string" ? el.license : "";

  const fields = {
    provider,
    general_id: generalId,
    specific_id: specificId,
    display_title: displayTitle,
    summary,
    license,
  };
  const empty = isExternalArtifactEmpty(fields);
  const validation = empty ? null : validateExternalArtifact(fields);
  const invalid = Boolean(validation && !validation.ok);

  const isHiddenNode = (node: unknown) => {
    const nodeId =
      node &&
      typeof node === "object" &&
      "id" in node &&
      typeof (node as { id?: unknown }).id === "string"
        ? (node as { id: string }).id
        : undefined;
    return nodeId ? Boolean(collapse?.isHidden(nodeId)) : false;
  };

  const handleRemove = useRemoveSelf(props, {
    replaceWithParagraph: true,
    id,
  });

  const updateNode = (patch: Partial<ExternalArtifactElement>) => {
    Transforms.setNodes(props.editor, patch, { at: props.path as any });
  };

  const handleProviderChange = (event: ChangeEvent<HTMLSelectElement>) => {
    updateNode({ provider: event.target.value as ExternalArtifactProvider | "" });
  };

  if (hidden) return null;

  const label = formatExternalArtifactLabel(fields);
  const previewLine = [
    provider || "provider?",
    generalId || "general_id?",
    specificId || "specific_id?",
  ].join(" · ");

  return (
    <PlateElement
      as="div"
      {...props}
      className="group relative my-3 rounded border border-neutral-200 bg-neutral-50 px-3 py-2"
    >
      <div
        contentEditable={false}
        className="flex items-center justify-between pr-7 text-xs text-neutral-600"
        onMouseDown={selectSelf}
      >
        <span />
        <span className="inline-flex items-center gap-1 rounded bg-neutral-100 px-2 py-0.5">
          <span className="text-[11px] font-semibold text-neutral-700">
            External artifact
          </span>
        </span>
      </div>

      {selected ? (
        <div contentEditable={false} className="mt-2 space-y-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Provider
              </div>
              <select
                value={provider}
                onChange={handleProviderChange}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  handleVoidBlockEdgeArrowExit(
                    props.editor as any,
                    props.path as any,
                    e,
                    { edge: "start", isHidden: isHiddenNode },
                  );
                }}
                className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              >
                <option value="">Select…</option>
                {EXTERNAL_ARTIFACT_PROVIDERS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Display title
              </div>
              <input
                value={displayTitle}
                onChange={(e) => updateNode({ display_title: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
                placeholder="Human-readable title"
              />
            </label>
          </div>
          <label className="block space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              General id
            </div>
            <input
              value={generalId}
              onChange={(e) => updateNode({ general_id: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              placeholder="e.g. owner/repo · 10.5281/zenodo.123 · 2001.00001 · abcde"
            />
          </label>
          <label className="block space-y-1">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
              Specific id (immutable)
            </div>
            <input
              value={specificId}
              onChange={(e) => updateNode({ specific_id: e.target.value })}
              onMouseDown={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
              className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
              placeholder="commit SHA · versioned DOI · v2 · v1"
            />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                Summary (optional)
              </div>
              <input
                value={summary}
                onChange={(e) => updateNode({ summary: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => e.stopPropagation()}
                className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
                placeholder="Short note"
              />
            </label>
            <label className="space-y-1">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">
                License (optional)
              </div>
              <input
                value={license}
                onChange={(e) => updateNode({ license: e.target.value })}
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  handleVoidBlockEdgeArrowExit(
                    props.editor as any,
                    props.path as any,
                    e,
                    { edge: "end", isHidden: isHiddenNode },
                  );
                }}
                className="h-7 w-full rounded border border-neutral-200 bg-white px-2 text-[11px] text-neutral-700"
                placeholder="e.g. MIT, CC-BY-4.0"
              />
            </label>
          </div>
          <div
            className={
              "rounded border px-2 py-1.5 text-[11px] " +
              (invalid
                ? "border-red-200 bg-red-50 text-red-700"
                : empty
                  ? "border-amber-200 bg-amber-50 text-amber-800"
                  : "border-neutral-200 bg-white text-neutral-600")
            }
          >
            {invalid && validation && !validation.ok
              ? validation.message
              : empty
                ? "Fill provider, general_id, specific_id, and display_title (CONCEPT App D)."
                : `${label} · ${previewLine}`}
          </div>
        </div>
      ) : (
        <VoidPreviewRegion
          label={label}
          description={
            invalid && validation && !validation.ok
              ? validation.message
              : empty
                ? "Missing external artifact fields"
                : [previewLine, summary].filter(Boolean).join(" — ")
          }
          onSelect={selectSelf}
          onRemove={() => handleRemove()}
          className={
            "mt-2 rounded border bg-white p-2 outline-none focus-visible:ring-2 focus-visible:ring-neutral-400 " +
            (invalid
              ? "border-red-200"
              : empty
                ? "border-amber-200"
                : "border-neutral-200")
          }
        >
          <div className="text-[12px] font-medium text-neutral-900">
            {displayTitle || "Untitled external artifact"}
          </div>
          <div className="mt-1 text-[11px] text-neutral-600">{previewLine}</div>
          {summary ? (
            <div className="mt-1 text-[11px] text-neutral-500">{summary}</div>
          ) : null}
          {license ? (
            <div className="mt-1 text-[10px] uppercase tracking-wide text-neutral-400">
              {license}
            </div>
          ) : null}
        </VoidPreviewRegion>
      )}

      <span className="absolute inset-0 opacity-0 pointer-events-none" aria-hidden>
        {props.children}
      </span>

      <RemoveButton
        onMouseDown={handleRemove}
        label="Remove external artifact"
      />
    </PlateElement>
  );
}

export const ExternalArtifactPlugin = createSlatePlugin({
  key: "externalArtifact",
  node: {
    type: "external_artifact",
    isElement: true,
    isVoid: true,
    component: ExternalArtifactComponent as any,
  },
});
