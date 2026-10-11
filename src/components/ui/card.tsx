import { cn } from "@/lib/utils";

/**
 * Carte de tableau de bord : surface blanche bordée, rayon xl, ombre légère.
 * Une section : lui donner un `aria-labelledby` qui pointe vers le titre de son CardHeader.
 */
export function Card({ className, children, ...props }: React.HTMLAttributes<HTMLElement>) {
  return (
    <section {...props} className={cn("rounded-xl border border-line bg-surface shadow-card", className)}>
      {children}
    </section>
  );
}

/**
 * En-tête de carte : titre 16 px semi-gras, nombre discret (décoratif, le contenu le montre
 * déjà), icône facultative, action à droite.
 */
export function CardHeader({
  id,
  title,
  count,
  icon,
  action,
  as: Heading = "h2",
  className,
}: {
  id?: string;
  title: React.ReactNode;
  count?: number;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-13 items-center gap-2 px-5 pb-3 pt-4", className)}>
      <Heading id={id} className="flex min-w-0 items-center gap-2 text-title font-semibold tracking-title">
        {icon}
        <span className="truncate">{title}</span>
        {count !== undefined && (
          <span aria-hidden="true" className="tabular text-ui font-medium text-muted">
            {count}
          </span>
        )}
      </Heading>
      {action && <div className="ml-auto flex shrink-0 items-center gap-2">{action}</div>}
    </div>
  );
}
