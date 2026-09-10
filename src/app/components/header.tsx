import { Link } from "react-router";
import { ActingUserSwitcher } from "./acting-user-switcher";
import { HeaderSearch } from "./header-search";
import { useActingUserOptional } from "../lib/acting-user";
import { canAccessModQueue } from "../../lib/modQueue";

export function Header() {
  const acting = useActingUserOptional();
  const showMod = canAccessModQueue(acting.user);

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-neutral-900">
            <span className="text-sm font-semibold text-white">CL</span>
          </div>
          <span className="text-lg font-semibold tracking-tight text-neutral-900">
            Civic Lab
          </span>
        </Link>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-4 sm:gap-6">
          <HeaderSearch />

          <nav className="hidden items-center gap-6 text-sm md:flex">
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
            {showMod ? (
              <Link
                to="/mod"
                className="text-neutral-600 transition-colors hover:text-neutral-900"
                data-testid="header-mod-link"
              >
                Moderation
              </Link>
            ) : null}
            <Link
              to="/docs"
              className="text-neutral-600 transition-colors hover:text-neutral-900"
            >
              Docs
            </Link>
          </nav>

          <ActingUserSwitcher />
        </div>
      </div>
    </header>
  );
}
