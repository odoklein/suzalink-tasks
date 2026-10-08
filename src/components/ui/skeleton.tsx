import { cn } from "@/lib/utils";

/** Bloc de chargement : reflet doux --sunken → --surface-2, immobile si les animations sont réduites. */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden="true" {...props} className={cn("skeleton rounded-sm", className)} />;
}

/** Une ligne de texte. */
export function SkeletonLine({ className, width = "100%" }: { className?: string; width?: string }) {
  return <Skeleton style={{ width }} className={cn("h-3", className)} />;
}

/** Une ligne de liste de tâches (icône + titre + méta). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("flex items-center gap-3 px-3 py-2.5", className)}>
      <Skeleton className="size-4 rounded-full" />
      <SkeletonLine width="55%" />
      <Skeleton className="ml-auto h-3 w-14" />
    </div>
  );
}

/** Une carte du tableau. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("space-y-3 rounded-md border border-line bg-surface p-3 shadow-card", className)}>
      <SkeletonLine width="85%" />
      <SkeletonLine width="60%" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="size-5 rounded-full" />
      </div>
    </div>
  );
}
