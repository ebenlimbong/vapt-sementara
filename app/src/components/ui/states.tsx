import { cn } from "@/lib/utils";

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-12 text-center", className)}>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function LoadingState({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} role="status" aria-label="Memuat data">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 w-full animate-pulse rounded-md bg-surface-2" />
      ))}
    </div>
  );
}

export function ErrorState({
  title = "Gagal memuat data",
  description,
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-lg border border-danger/40 bg-danger/5 py-10 text-center", className)}>
      <p className="text-sm font-medium text-danger">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted">{description}</p>}
      {onRetry && (
        <button onClick={onRetry} className="mt-1 text-xs font-medium text-accent underline">
          Coba lagi
        </button>
      )}
    </div>
  );
}
