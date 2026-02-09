import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function DocsNavControls() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="ms-auto flex items-center gap-3">
      <a
        href="/"
        className="text-xs font-semibold text-neutral-500 hover:text-neutral-900"
      >
        Home
      </a>
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="inline-flex items-center rounded-full border border-neutral-200 p-1 text-neutral-500 hover:text-neutral-900"
      >
        {isDark ? (
          <Moon className="h-4 w-4" />
        ) : (
          <Sun className="h-4 w-4" />
        )}
      </button>
    </div>
  );
}
