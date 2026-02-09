import { RouterProvider } from "react-router";
import { router } from "./routes";
import { DocsProviders } from "./DocsProviders";

export default function App() {
  return (
    <DocsProviders>
      <RouterProvider router={router} />
    </DocsProviders>
  );
}
