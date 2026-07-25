import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { useId } from "react";

export function truncateForAria(text: string, max = 140): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t) return "";
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

export function voidPreviewKeyDown(args: {
  event: KeyboardEvent;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  const { event, onSelect, onRemove } = args;
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    onSelect();
    return;
  }
  if (
    onRemove &&
    (event.key === "Delete" || event.key === "Backspace") &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.altKey
  ) {
    event.preventDefault();
    event.stopPropagation();
    onRemove();
  }
}

export function removeButtonKeyDown(
  event: KeyboardEvent,
  onRemove: (e: MouseEvent | KeyboardEvent) => void,
) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    event.stopPropagation();
    onRemove(event);
  }
}

/** Focusable preview region with aria-label + optional describedby summary. */
export function VoidPreviewRegion({
  label,
  description,
  onSelect,
  onRemove,
  className,
  children,
}: {
  label: string;
  description?: string;
  onSelect: (event: MouseEvent | KeyboardEvent) => void;
  onRemove?: () => void;
  className?: string;
  children: ReactNode;
}) {
  const descId = useId();
  const summary = description ? truncateForAria(description) : "";

  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={label}
      aria-describedby={summary ? descId : undefined}
      contentEditable={false}
      className={className}
      onMouseDown={(event) => {
        onSelect(event);
      }}
      onKeyDown={(event) => {
        voidPreviewKeyDown({
          event,
          onSelect: () => onSelect(event),
          onRemove,
        });
      }}
    >
      {summary ? (
        <span id={descId} className="sr-only">
          {summary}
        </span>
      ) : null}
      {children}
    </div>
  );
}

export const REMOVE_BUTTON_BASE =
  "absolute flex h-6 w-6 items-center justify-center rounded border border-neutral-200 bg-white text-xs text-neutral-600 shadow-sm opacity-0 hover:bg-neutral-100 focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100";

export const REMOVE_BUTTON_CLASS = `${REMOVE_BUTTON_BASE} right-2 top-2`;

export const REMOVE_BUTTON_INLINE_CLASS =
  "absolute -right-3 -top-3 flex h-5 w-5 items-center justify-center rounded border border-neutral-200 bg-white text-[11px] text-neutral-600 shadow-sm opacity-0 hover:bg-neutral-100 focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100";
