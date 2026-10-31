import { LogOut } from "lucide-react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";
import { Button } from "./ui/primitives";

/** Always-visible account bar: who is signed in, and a clear way to sign out. */
export function TopBar({
  title,
  subtitle,
  onSignOut,
  children,
}: {
  title: string;
  subtitle?: string;
  onSignOut: () => void;
  children?: React.ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-card/95 px-4 py-2.5 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <Logo size={36} className="shrink-0 rounded-full lg:hidden" />
        <span aria-hidden className="hidden size-9 shrink-0 items-center justify-center rounded-full bg-navy-2 text-sm font-bold text-white lg:flex">
          {title.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{title}</p>
          {subtitle && <p className="truncate text-xs text-muted">{subtitle}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {children}
        <ThemeToggle className="hidden lg:inline-flex" />
        <Button variant="secondary" onClick={onSignOut} aria-label="Sign out" className="size-10 !px-0 lg:h-9 lg:w-auto lg:!px-3.5">
          <LogOut className="size-4" aria-hidden /> <span className="hidden lg:inline">Sign out</span>
        </Button>
      </div>
    </div>
  );
}
