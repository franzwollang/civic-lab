import { Link } from "react-router";
import { HeaderSearch } from "./header-search";

export function Header() {
  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-8">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-neutral-900">
            <span className="text-sm font-semibold text-white">CL</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-neutral-900">
            Civic Lab
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <HeaderSearch />

          <nav className="flex items-center gap-6 text-sm">
            <Link
              to="/about"
              className="text-neutral-600 transition-colors hover:text-neutral-900"
            >
              About
            </Link>
            <Link
              to="/canon"
              className="text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Canon
            </Link>
            <Link
              to="/manuals"
              className="text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Manuals
            </Link>
            <Link
              to="/docs"
              className="text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Docs
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
