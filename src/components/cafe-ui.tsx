import type { ReactNode } from "react";
import { Info, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";

export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string | undefined;
  children?: ReactNode | undefined;
}) {
  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <h1 className="font-display text-2xl md:text-3xl">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  trend,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string | undefined;
  trend?: number | undefined;
  tone?: "default" | "sage" | "terracotta" | "warning" | undefined;
}) {
  const toneRing = {
    default: "",
    sage: "border-sage/40 bg-sage-soft/50",
    terracotta: "border-terracotta/40 bg-terracotta-soft/50",
    warning: "border-warning/50 bg-warning/10",
  }[tone];

  return (
    <div className={cn("card-surface p-4", toneRing)}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl">{value}</p>
      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
        {typeof trend === "number" ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 font-medium",
              trend >= 0 ? "text-sage" : "text-terracotta",
            )}
          >
            {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {Math.abs(Math.round(trend))}%
          </span>
        ) : null}
        {hint ? <span>{hint}</span> : null}
      </div>
    </div>
  );
}

const badgeTones: Record<string, string> = {
  "In stock": "bg-sage-soft text-sage-foreground border-sage/40 text-foreground",
  Balanced: "bg-sage-soft border-sage/40 text-foreground",
  Complete: "bg-sage-soft border-sage/40 text-foreground",
  Approved: "bg-sage-soft border-sage/40 text-foreground",
  "Low stock": "bg-warning/20 border-warning/50 text-foreground",
  "In progress": "bg-warning/20 border-warning/50 text-foreground",
  Pending: "bg-warning/20 border-warning/50 text-foreground",
  Understaffed: "bg-terracotta-soft border-terracotta/40 text-foreground",
  Critical: "bg-terracotta-soft border-terracotta/40 text-foreground",
  "Out of stock": "bg-destructive/15 border-destructive/40 text-foreground",
  "Attention needed": "bg-terracotta-soft border-terracotta/40 text-foreground",
  Overstaffed: "bg-accent border-border text-foreground",
  "Not started": "bg-muted border-border text-muted-foreground",
  Draft: "bg-muted border-border text-muted-foreground",
  Rejected: "bg-muted border-border text-muted-foreground",
};

export function StatusBadge({ status, className }: { status: string; className?: string | undefined }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        badgeTones[status] ?? "bg-muted border-border text-muted-foreground",
        className,
      )}
    >
      {status}
    </span>
  );
}

export function WhyTooltip({ reason }: { reason?: string | null }) {
  if (!reason) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Why this recommendation"
          className="inline-flex size-5 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-xs leading-relaxed">{reason}</TooltipContent>
    </Tooltip>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string | undefined }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 p-8 text-center">
      <p className="font-display text-base">{title}</p>
      {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function LoadingBlock({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full rounded-lg" />
      ))}
    </div>
  );
}

export function ErrorState({ message }: { message?: string | undefined }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-5 text-sm">
      <p className="font-medium">We couldn't load this information.</p>
      <p className="mt-1 text-muted-foreground">
        {message ?? "Please check your connection and try again."}
      </p>
    </div>
  );
}

export function SourceLabel({ source }: { source: string }) {
  const map: Record<string, string> = {
    system: "System recommendation",
    override: "Manager override",
    approved: "Approved plan",
  };
  return (
    <span className="text-xs text-muted-foreground">{map[source] ?? "System recommendation"}</span>
  );
}
