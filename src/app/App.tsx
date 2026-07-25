import { RouterProvider } from "react-router";
import { router } from "./routes";
import { DocsProviders } from "./DocsProviders";
import { ActingUserProvider } from "./lib/acting-user";

export default function App() {
  return (
    <DocsProviders>
      <ActingUserProvider>
        <RouterProvider router={router} />
      </ActingUserProvider>
    </DocsProviders>
  );
}
