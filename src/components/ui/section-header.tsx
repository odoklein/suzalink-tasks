import { cn } from "@/lib/utils";

/**
 * Titre de section, un seul style : 12 px semi-gras discret, casse normale. Le nombre est
 * décoratif (le contenu le montre déjà) : masqué aux lecteurs d’écran.
 */
export function SectionHeader({
  title,
  count,
  icon,
  action,
  as: Heading = "h2",
  id,
  className,
}: {
  title: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3" | "h4";
  id?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center gap-2", className)}>
      <Heading id={id} className="flex items-center gap-1.5 text-xs font-semibold text-muted">
        {icon}
        {title}
        {count !== undefined && (
          <span aria-hidden="true" className="tabular font-medium text-faint">
            {count}
          </span>
        )}
      </Heading>
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}
