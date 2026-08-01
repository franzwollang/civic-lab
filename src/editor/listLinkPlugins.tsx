import type { CSSProperties } from "react";
import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import { KEYS } from "platejs";
import { IndentPlugin } from "@platejs/indent/react";
import { ListPlugin } from "@platejs/list/react";
import { LinkPlugin } from "@platejs/link/react";

/** Blocks that may carry flat-list indent / listStyleType props. */
const LIST_TARGET_PLUGINS = [KEYS.p, KEYS.h2, KEYS.h3, KEYS.h4];

function LinkElement(props: PlateElementProps) {
  const element = props.element as { url?: string; target?: string };
  const url = typeof element.url === "string" ? element.url : "";
  const target =
    typeof element.target === "string" ? element.target : undefined;

  return (
    <PlateElement
      as="a"
      className="font-medium text-sky-800 underline underline-offset-2"
      href={url || undefined}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      {...props}
      onClick={(event) => {
        // Keep editor selection; open URL with modifier click.
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
        }
      }}
    >
      {props.children}
    </PlateElement>
  );
}

export const IndentListPluginConfigured = IndentPlugin.configure({
  inject: {
    targetPlugins: LIST_TARGET_PLUGINS,
  },
});

export const ListPluginConfigured = ListPlugin.configure({
  inject: {
    targetPlugins: LIST_TARGET_PLUGINS,
  },
});

export const LinkPluginConfigured = LinkPlugin.withComponent(LinkElement);

/** List indent padding helper for block components that may be list items. */
export function listItemStyle(element: {
  listStyleType?: unknown;
  indent?: unknown;
}): { className: string; style?: CSSProperties } | null {
  const listStyleType =
    typeof element.listStyleType === "string" ? element.listStyleType : null;
  if (!listStyleType) return null;
  const indent =
    typeof element.indent === "number" && element.indent > 0
      ? element.indent
      : 1;
  return {
    className: "mb-1 list-item text-sm leading-7",
    style: {
      listStyleType,
      marginLeft: `${indent * 1.25}rem`,
    },
  };
}
