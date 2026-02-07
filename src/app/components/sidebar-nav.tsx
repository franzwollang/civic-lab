import { Link } from "react-router";
import { Home, FileText, MessageSquare, GitBranch, Shield } from "lucide-react";

interface SidebarNavProps {
  dossierId?: string;
  currentPage?: "dossier" | "artifact" | "thread" | "rfc" | "red-team";
}

export function SidebarNav({ dossierId, currentPage }: SidebarNavProps) {
  return (
    <aside className="fixed left-0 top-16 h-[calc(100vh-4rem)] w-64 border-r border-neutral-200 bg-white">
      <div className="p-6">
        <nav className="space-y-1">
          <Link
            to="/"
            className="flex items-center gap-3 rounded px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </Link>

          {dossierId && (
            <>
              <div className="mb-2 mt-6 px-3 text-xs font-medium uppercase tracking-wider text-neutral-400">
                Current Dossier
              </div>
              <Link
                to={`/dossier/${dossierId}`}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                  currentPage === "dossier"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <FileText className="h-4 w-4" />
                <span>Overview</span>
              </Link>
              <Link
                to={`/dossier/${dossierId}`}
                className="flex items-center gap-3 rounded px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Threads</span>
              </Link>
              <Link
                to={`/dossier/${dossierId}`}
                className="flex items-center gap-3 rounded px-3 py-2 text-sm text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900"
              >
                <GitBranch className="h-4 w-4" />
                <span>RFCs</span>
              </Link>
              <Link
                to={`/dossier/${dossierId}/red-team/1`}
                className={`flex items-center gap-3 rounded px-3 py-2 text-sm transition-colors ${
                  currentPage === "red-team"
                    ? "bg-neutral-900 text-white"
                    : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900"
                }`}
              >
                <Shield className="h-4 w-4" />
                <span>Red Team</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </aside>
  );
}
