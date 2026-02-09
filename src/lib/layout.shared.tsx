import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { DocsNavControls } from "../app/DocsNavControls";

export const baseOptions: BaseLayoutProps = {
  nav: {
    title: "Civic Lab Docs",
    url: "/docs",
  },
  themeSwitch: {
    component: <DocsNavControls />,
  },
};
