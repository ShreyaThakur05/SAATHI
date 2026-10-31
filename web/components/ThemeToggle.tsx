"use client";

import clsx from "clsx";
import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

const KEY = "saathi.theme";
type Theme = "light" | "dark";

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
};
const current = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");

/** Light/dark switch. The initial theme is set by an inline script in the layout, so there is no flash. */
export function ThemeToggle({ className, label = false }: { className?: string; label?: boolean }) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem(KEY, next);
        } catch {
          /* storage can be blocked; the choice then lasts for this visit only */
        }
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className={clsx("inline-flex size-10 items-center justify-center rounded-full text-muted ring-1 ring-line hover:text-ink", label && "w-auto gap-2 px-4", className)}
    >
      {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
      {label && <span className="text-sm font-medium">{theme === "dark" ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}

/** Runs before first paint: saved choice, else the system preference. */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${KEY}");if(t!=="light"&&t!=="dark"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme="light"}})();`;
