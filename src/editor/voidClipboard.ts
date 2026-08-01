import { createSlatePlugin } from "platejs";
import type { Editor } from "slate";

import { serializeNodes } from "@/doc/plainTextExport";
import {
  insertDataBlock,
  insertExternalArtifact,
  insertImageBlock,
  insertMermaidBlock,
  insertProcedureBlock,
} from "./blockCommands";
import { insertCitationInline, insertTermInline } from "./evidenceCommands";
import { insertMathBlock, insertMathInline } from "./mathCommands";
import { parseExternalArtifactFenceBody } from "@/lib/externalArtifact";

export type ParsedVoidPaste =
  | { kind: "math_inline"; latex: string }
  | { kind: "math_block"; latex: string }
  | { kind: "mermaid"; code: string }
  | { kind: "procedure"; code: string }
  | { kind: "data"; language: string; code: string }
  | { kind: "image"; src: string; alt: string; caption: string }
  | {
      kind: "external_artifact";
      provider: string;
      general_id: string;
      specific_id: string;
      display_title: string;
      summary: string;
      license: string;
    }
  | { kind: "citation"; attributionRef: string }
  | { kind: "term"; termRef: string; label: string };

const FENCED_RE =
  /^```([A-Za-z0-9_.+-]+)[ \t]*\n([\s\S]*?)\n```[ \t]*$/;
const DISPLAY_MATH_RE = /^\$\$\n?([\s\S]*?)\n?\$\$$/;
const INLINE_MATH_RE = /^\$([^\$\n]+)\$$/;
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]+)\)(?:\n([^\n]+))?$/;
const CITE_RE = /^\[cite:([^\]]+)\]$/;
const TERM_RE = /^\[term:([^\]|]+)(?:\|([^\]]*))?\]$/;

const DATA_LANGS = new Set(["json", "yaml", "yml", "toml", "csv"]);

/** Parse a plain-text clipboard payload into a void insert when it matches export forms. */
export function parseVoidPlainText(raw: string): ParsedVoidPaste | null {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return null;

  const fence = text.match(FENCED_RE);
  if (fence) {
    const lang = fence[1].toLowerCase();
    const code = fence[2] ?? "";

    if (lang === "mermaid") {
      return { kind: "mermaid", code };
    }

    if (
      lang === "pseudocode.js" ||
      lang === "pseudocode" ||
      lang === "procedure"
    ) {
      return { kind: "procedure", code };
    }

    if (lang === "external_artifact") {
      const parsed = parseExternalArtifactFenceBody(code);
      if (parsed) {
        return {
          kind: "external_artifact",
          provider: parsed.provider ?? "",
          general_id: parsed.general_id ?? "",
          specific_id: parsed.specific_id ?? "",
          display_title: parsed.display_title ?? "",
          summary: parsed.summary ?? "",
          license: parsed.license ?? "",
        };
      }
      return null;
    }

    const normalized = lang === "yml" ? "yaml" : lang;
    if (DATA_LANGS.has(lang)) {
      return { kind: "data", language: normalized, code };
    }

    return null;
  }

  const display = text.match(DISPLAY_MATH_RE);
  if (display) {
    return { kind: "math_block", latex: (display[1] ?? "").trim() };
  }

  const inline = text.match(INLINE_MATH_RE);
  if (inline) {
    return { kind: "math_inline", latex: inline[1] ?? "" };
  }

  const image = text.match(IMAGE_RE);
  if (image) {
    return {
      kind: "image",
      alt: image[1] ?? "",
      src: image[2] ?? "",
      caption: (image[3] ?? "").trim(),
    };
  }

  const cite = text.match(CITE_RE);
  if (cite) {
    return { kind: "citation", attributionRef: cite[1] ?? "" };
  }

  const term = text.match(TERM_RE);
  if (term) {
    return {
      kind: "term",
      termRef: term[1] ?? "",
      label: term[2] ?? "term",
    };
  }

  return null;
}

/** Insert a parsed void paste into the editor. */
export function applyVoidPaste(editor: Editor, parsed: ParsedVoidPaste): void {
  switch (parsed.kind) {
    case "math_inline":
      insertMathInline(editor, parsed.latex);
      return;
    case "math_block":
      insertMathBlock(editor, parsed.latex);
      return;
    case "mermaid":
      insertMermaidBlock(editor, parsed.code);
      return;
    case "procedure":
      insertProcedureBlock(editor, parsed.code);
      return;
    case "data":
      insertDataBlock(editor, parsed.language, parsed.code);
      return;
    case "image":
      insertImageBlock(editor, parsed.src, parsed.alt, parsed.caption);
      return;
    case "external_artifact":
      insertExternalArtifact(editor, {
        provider: parsed.provider,
        general_id: parsed.general_id,
        specific_id: parsed.specific_id,
        display_title: parsed.display_title,
        summary: parsed.summary,
        license: parsed.license,
      });
      return;
    case "citation":
      insertCitationInline(editor, parsed.attributionRef);
      return;
    case "term":
      insertTermInline(editor, parsed.termRef, parsed.label);
      return;
  }
}

type ClipboardEditor = Editor & {
  setFragmentData: (
    data: DataTransfer,
    originEvent?: "drag" | "copy" | "cut",
  ) => void;
  insertTextData: (data: DataTransfer) => boolean;
};

/** Wrap Slate React clipboard hooks so voids round-trip as Markdown-ish plain text. */
export function installVoidClipboard(editor: Editor): void {
  const e = editor as ClipboardEditor;
  const { setFragmentData, insertTextData } = e;

  e.setFragmentData = (data, originEvent) => {
    setFragmentData.call(e, data, originEvent);
    try {
      const fragment = editor.getFragment();
      const plain = serializeNodes(fragment as unknown[]);
      if (plain.length > 0) {
        data.setData("text/plain", plain);
      }
    } catch {
      // Keep default fragment data if serialization fails.
    }
  };

  e.insertTextData = (data) => {
    const raw = data.getData("text/plain");
    if (raw) {
      const parsed = parseVoidPlainText(raw);
      if (parsed) {
        applyVoidPaste(editor, parsed);
        return true;
      }
    }
    return insertTextData.call(e, data);
  };
}

/**
 * Plate plugin: enhances copy/cut plain text and paste of void export forms.
 * Keep page-level onPaste only as a fallback; prefer this path.
 */
export const VoidClipboardPlugin = createSlatePlugin({
  key: "voidClipboard",
  extendEditor: ({ editor }) => {
    installVoidClipboard(editor as unknown as Editor);
    return editor;
  },
});
