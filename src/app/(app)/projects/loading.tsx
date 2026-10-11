import { LoadingBlock, PageLoading } from "@/components/page-loading";

/** Gabarit de la liste des projets : un titre, puis la grille de cartes. */
export default function Loading() {
  return (
    <PageLoading label="Chargement des projets" width="wide">
      <LoadingBlock className="h-8 w-40" />
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((card) => (
          <div key={card} aria-hidden="true" className="h-36 rounded-lg border border-line bg-surface shadow-card" />
        ))}
      </div>
    </PageLoading>
  );
}
