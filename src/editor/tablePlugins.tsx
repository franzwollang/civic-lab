import type { PlateElementProps } from "platejs/react";
import { PlateElement } from "platejs/react";
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from "@platejs/table/react";

function TableElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="table"
      className="mb-3 w-full border-collapse border border-neutral-300 text-sm"
      {...props}
    >
      <tbody className="[&>tr]:border-b [&>tr]:border-neutral-200">
        {props.children}
      </tbody>
    </PlateElement>
  );
}

function TableRowElement(props: PlateElementProps) {
  return (
    <PlateElement as="tr" className="border-b border-neutral-200" {...props}>
      {props.children}
    </PlateElement>
  );
}

function TableCellElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="td"
      className="border border-neutral-200 px-2 py-1.5 align-top text-sm leading-6"
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

function TableCellHeaderElement(props: PlateElementProps) {
  return (
    <PlateElement
      as="th"
      className="border border-neutral-200 bg-neutral-50 px-2 py-1.5 text-left text-sm font-semibold leading-6"
      {...props}
    >
      {props.children}
    </PlateElement>
  );
}

/** Plate 52 table kit with minimal Civic Lab chrome (no column resize UI yet). */
export const tablePlugins = [
  TablePlugin.withComponent(TableElement),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableCellHeaderElement),
];
