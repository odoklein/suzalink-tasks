import type { Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TILE: Partial<Record<Tone, string>> = {
  accent: "bg-accent-soft text-accent",
  waiting: "bg-waiting-soft text-waiting-text",
  done: "bg-done-soft text-done-text",
  danger: "bg-danger-soft text-danger-text",
  neutral: "bg-sunken text-muted",
};

/**
 * État vide : pastille d’icône teintée, titre, explication et action suivante.
 * `compact` pour un panneau étroit (titre 13 px, sans pastille agrandie).
 */
export function EmptyState({
  icon,
  title,
  children,
  action,
  tone = "accent",
  compact = false,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  tone?: Tone;
  compact?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-3 py-6" : "px-4 py-12", className)}>
      {icon && (
        <span className={cn("mb-3 grid shrink-0 place-items-center rounded-lg [&>svg]:size-5", compact ? "size-8" : "size-10", TILE[tone] ?? TILE.neutral)}>
          {icon}
        </span>
      )}
      <p className={cn("font-semibold", compact ? "text-ui" : "font-display text-h2 tracking-[-0.01em]")}>{title}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-ui text-muted">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
