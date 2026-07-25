import type { MouseEvent, ReactNode } from "react";
import type { PlateElementProps } from "platejs/react";
import { ParagraphPlugin, PlateElement } from "platejs/react";
import {
  BlockquotePlugin,
  H2Plugin,
  H3Plugin,
  H4Plugin,
} from "@platejs/basic-nodes/react";

import { MathBlockPlugin, MathInlinePlugin } from "./math-nodes";
import { CollapseProvider, useCollapseContext } from "./collapse";
import {
  DataBlockPlugin,
  ImageBlockPlugin,
  MermaidBlockPlugin,
  ProcedureBlockPlugin,
} from "./void-blocks";
import { ExternalArtifactPlugin } from "./external-artifact-nodes";
import {
  CitationInlinePlugin,
  EvidenceBlockPlugin,
  EvidenceBlockDataPlugin,
  EvidenceBlockMathPlugin,
  EvidenceBlockTextPlugin,
  EvidenceBlockTranslationPlugin,
  TermInlinePlugin,
} from "./evidence-nodes";
import { VoidClipboardPlugin } from "./voidClipboard";
import {
  IndentListPluginConfigured,
  LinkPluginConfigured,
  ListPluginConfigured,
  listItemStyle,
} from "./listLinkPlugins";

export { CollapseProvider } from "./collapse";

function CollapsibleBlock({
  as,
  className,
  props,
  isHeader,
}: {
  as: "p" | "h2" | "h3" | "h4";
  className: string;
  props: PlateElementProps;
  isHeader: boolean;
}) {
  const collapse = useCollapseContext();
  const element = props.element as { id?: string };
  const id = typeof element?.id === "string" ? element.id : undefined;
  const hidden = id ? collapse?.isHidden(id) : false;
  const collapsed = id ? collapse?.isCollapsed(id) : false;

  const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (id && isHeader) collapse?.toggleCollapse(id);
  };

  if (hidden) return null;

  return (
    <PlateElement
      as={as}
      className={`relative pl-5 ${className}`}
      {...props}
    >
      {id && collapse && isHeader && (
        <span
          contentEditable={false}
          className="absolute left-0 top-1 inline-flex h-4 w-4 items-center justify-center text-[10px] text-neutral-400"
        >
          <button
            type="button"
            onMouseDown={handleToggle}
            className="h-4 w-4 rounded hover:bg-neutral-100"
            aria-label={collapsed ? "Expand block" : "Collapse block"}
          >
            {collapsed ? ">" : "v"}
          </button>
        </span>
      )}
      {props.children}
    </PlateElement>
  );
}

function ParagraphElement(props: PlateElementProps) {
  const list = listItemStyle(
    props.element as { listStyleType?: unknown; indent?: unknown },
  );
  if (list) {
    return (
      <PlateElement as="div" className={list.className} style={list.style} {...props}>
        {props.children}
      </PlateElement>
    );
  }
  return (
    <CollapsibleBlock
      as="p"
      className="mb-3 text-sm leading-7"
      props={props}
      isHeader={false}
    />
  );
}

function HeadingElement(props: PlateElementProps) {
  return (
    <CollapsibleBlock
      as="h2"
      className="mb-3 text-2xl font-semibold"
      props={props}
      isHeader={true}
    />
  );
}

function SubheadingElement(props: PlateElementProps) {
  return (
    <CollapsibleBlock
      as="h3"
      className="mb-2 text-lg font-semibold"
      props={props}
      isHeader={true}
    />
  );
}

function SubsubheadingElement(props: PlateElementProps) {
  return (
    <CollapsibleBlock
      as="h4"
      className="mb-2 text-base font-semibold uppercase tracking-wide"
      props={props}
      isHeader={true}
    />
  );
}

function BlockquoteElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="blockquote"
      className="mb-3 border-l-2 border-neutral-300 pl-4 text-sm italic leading-7 text-neutral-600"
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

export const editorPlugins = [
  ParagraphPlugin.withComponent(ParagraphElement),
  H2Plugin.configure({ node: { component: HeadingElement } }),
  H3Plugin.configure({ node: { component: SubheadingElement } }),
  H4Plugin.configure({ node: { component: SubsubheadingElement } }),
  BlockquotePlugin.withComponent(BlockquoteElement),
  IndentListPluginConfigured,
  ListPluginConfigured,
  LinkPluginConfigured,
  MathInlinePlugin,
  MathBlockPlugin,
  CitationInlinePlugin,
  TermInlinePlugin,
  EvidenceBlockPlugin,
  EvidenceBlockDataPlugin,
  EvidenceBlockMathPlugin,
  EvidenceBlockTextPlugin,
  EvidenceBlockTranslationPlugin,
  MermaidBlockPlugin,
  ProcedureBlockPlugin,
  DataBlockPlugin,
  ImageBlockPlugin,
  ExternalArtifactPlugin,
  VoidClipboardPlugin,
];

export const initialValue: Array<Record<string, unknown>> = [
  {
    type: "h2",
    id: "block-1",
    children: [{ text: "Voting systems overview" }],
  },
  {
    type: "p",
    id: "block-2",
    children: [
      {
        text: "Draft notes for the voting systems page. Use headings, paragraphs, and lists as needed.",
      },
    ],
  },
];
