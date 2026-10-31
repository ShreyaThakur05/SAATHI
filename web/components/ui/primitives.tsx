import clsx from "clsx";
import { AlertTriangle, Inbox, Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

export function Button({
  variant = "primary",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={clsx(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-sm font-semibold transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-navy-2 text-white hover:bg-navy",
        variant === "secondary" && "border border-line bg-card text-ink hover:bg-surface",
        variant === "ghost" && "text-muted hover:bg-surface hover:text-ink",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        className,
      )}
    >
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <section className={clsx("rounded-xl border border-line bg-card", className)}>{children}</section>;
}

export function CardHeader({ title, action, hint }: { title: string; action?: ReactNode; hint?: string }) {
  return (
    <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <div>
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      </div>
      {action}
    </header>
  );
}

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "success" | "warn" | "danger" | "info" | "dark";
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide",
        tone === "neutral" && "bg-surface text-muted ring-1 ring-line",
        tone === "success" && "bg-success/10 text-success",
        tone === "warn" && "bg-warn/10 text-warn",
        tone === "danger" && "bg-danger/10 text-danger",
        tone === "info" && "bg-brand/15 text-brand-ink",
        tone === "dark" && "bg-navy text-white",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "success" | "warn";
}) {
  return (
    <div className="rounded-xl border border-line bg-card p-4">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p
        className={clsx(
          "mt-1 text-2xl font-bold tabular-nums",
          tone === "success" ? "text-success" : tone === "warn" ? "text-warn" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted">{sub}</p>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("animate-pulse rounded-md bg-line/70", className)} aria-hidden />;
}

export function EmptyState({
  title,
  body,
  action,
  icon: Icon = Inbox,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: typeof Inbox;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
      <Icon className="size-8 text-muted/60" aria-hidden />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {body && <p className="max-w-sm text-sm text-muted">{body}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <AlertTriangle className="size-8 text-danger" aria-hidden />
      <p className="max-w-sm text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Field({ label, children, error }: { label: string; children: ReactNode; error?: string }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium text-ink">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  "h-10 w-full rounded-lg border border-line bg-card px-3 text-sm text-ink placeholder:text-muted/70 focus:border-navy-2 focus:outline-none";
