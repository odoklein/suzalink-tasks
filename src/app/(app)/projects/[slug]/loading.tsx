/** Gabarit de la page projet pendant son chargement : l’en-tête, les onglets et les colonnes du tableau. */
function Block({ className, width }: { className: string; width?: number }) {
  // Blocs fixes, sans reflet : une quinzaine de blocs animés en boucle coûteraient plus qu’ils n’apportent.
  return <div aria-hidden="true" style={width ? { width } : undefined} className={`rounded-sm bg-sunken ${className}`} />;
}

const COLUMN_CARDS = [3, 2, 2, 1, 1];

export default function Loading() {
  return (
    // Le gabarit n’apparaît qu’après 150 ms : une navigation rapide n’affiche rien, une lente montre la structure.
    <div
      role="status"
      aria-label="Chargement du projet"
      className="flex min-h-0 flex-1 flex-col"
      style={{ animation: "fade-in var(--dur-2) var(--ease-out) 150ms both" }}
    >
      <header className="border-b border-line bg-surface px-4 pt-4 sm:px-8">
        <div className="flex items-center gap-3">
          <Block className="size-8 rounded-lg" />
          <Block className="h-6 w-48" />
          <Block className="h-5 w-20 rounded-full" />
        </div>
        <div className="mt-4 flex gap-4 pb-3">
          {[64, 48, 64, 72, 104, 64].map((width, index) => (
            <Block key={index} width={width} className="h-4" />
          ))}
        </div>
      </header>
      <div className="flex min-h-0 flex-1 gap-3 overflow-hidden px-4 pt-5 sm:px-8">
        {COLUMN_CARDS.map((cards, column) => (
          <div key={column} className="flex w-[272px] shrink-0 flex-col gap-2 rounded-lg bg-sunken p-2">
            <div className="h-5" />
            {Array.from({ length: cards }, (_, card) => (
              <div key={card} aria-hidden="true" className="space-y-3 rounded-md border border-line bg-surface p-3 shadow-card">
                <Block className="h-3 w-4/5" />
                <Block className="h-3 w-3/5" />
              </div>
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement du projet…</span>
    </div>
  );
}
