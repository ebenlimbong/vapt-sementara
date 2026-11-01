import { cn } from "@/lib/utils";
import type { Severity } from "@/lib/cvss4";

const SEVERITY_CLASSES: Record<Severity, string> = {
  critical: "bg-severity-critical/15 text-severity-critical border-severity-critical/40",
  high: "bg-severity-high/15 text-severity-high border-severity-high/40",
  medium: "bg-severity-medium/15 text-severity-medium border-severity-medium/40",
  low: "bg-severity-low/15 text-severity-low border-severity-low/40",
  info: "bg-severity-info/15 text-severity-info border-severity-info/40",
};

export function SeverityBadge({ severity }: { severity: Severity | string }) {
  const s = (severity as Severity) in SEVERITY_CLASSES ? (severity as Severity) : "info";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium uppercase tracking-wide font-data",
        SEVERITY_CLASSES[s]
      )}
    >
      {s}
    </span>
  );
}

export function Badge({
  children,
  variant = "default",
  className,
}: {
  children: React.ReactNode;
  variant?: "default" | "outline" | "success" | "warning" | "danger" | "muted";
  className?: string;
}) {
  const variants: Record<string, string> = {
    default: "bg-surface-2 text-foreground border-border",
    outline: "bg-transparent text-foreground border-border",
    success: "bg-success/15 text-success border-success/40",
    warning: "bg-warning/15 text-warning border-warning/40",
    danger: "bg-danger/15 text-danger border-danger/40",
    muted: "bg-transparent text-muted border-border",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}

export function RatingBadge({ rating }: { rating: string | null | undefined }) {
  if (!rating) {
    return <Badge variant="muted">Belum ada rating</Badge>;
  }
  const colorMap: Record<string, string> = {
    A: "bg-success/15 text-success border-success/40",
    B: "bg-severity-low/15 text-severity-low border-severity-low/40",
    C: "bg-severity-medium/15 text-severity-medium border-severity-medium/40",
    D: "bg-severity-high/15 text-severity-high border-severity-high/40",
    F: "bg-severity-critical/15 text-severity-critical border-severity-critical/40",
  };
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border text-sm font-bold font-data",
        colorMap[rating] ?? "bg-surface-2 border-border"
      )}
    >
      {rating}
    </span>
  );
}
