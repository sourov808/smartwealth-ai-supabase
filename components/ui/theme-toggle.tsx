"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

type Theme = "light" | "dark";

/**
 * Light/dark switch.
 *
 * The theme is already applied by the blocking script in app/layout.tsx; this
 * only reads and updates it. It renders a fixed-size placeholder until mounted
 * rather than nothing at all — returning null would let the surrounding layout
 * shift by the width of the button on hydration.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "dark" : "light");
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      // Private mode or blocked storage. The theme still applies for this
      // session; only the preference is lost.
    }
    setTheme(next);
  }

  if (theme === null) {
    return <div className={className} style={{ width: 28, height: 28 }} aria-hidden />;
  }

  const Icon = theme === "dark" ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggle}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      className={`inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-ink-faint transition-colors hover:bg-paper-sunken hover:text-ink ${className ?? ""}`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );
}
