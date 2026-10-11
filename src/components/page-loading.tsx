/**
 * Cadre commun des écrans de chargement (`loading.tsx`) : annoncé comme un statut, invisible les
 * 150 premières ms (une navigation rapide n’affiche rien, une lente montre la structure), blocs
 * fixes sans reflet (quelques blocs animés en boucle coûteraient plus qu’ils n’apportent).
 */
export function PageLoading({ label, width, children }: { label: string; width: "wide" | "narrow"; children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto" role="status" aria-label={label}>
      <div
        className={`mx-auto px-4 py-6 sm:px-8 sm:py-8 ${width === "wide" ? "max-w-[var(--page-wide)]" : "max-w-[var(--page-narrow)]"}`}
        style={{ animation: "fade-in var(--dur-2) var(--ease-out) 150ms both" }}
      >
        {children}
        <span className="sr-only">{label}…</span>
      </div>
    </div>
  );
}

/** Bloc de gabarit : fixe, décoratif. */
export function LoadingBlock({ className }: { className: string }) {
  return <div aria-hidden="true" className={`rounded-sm bg-sunken ${className}`} />;
}
