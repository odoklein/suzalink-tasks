import { LoadingBlock, PageLoading } from "@/components/page-loading";

/** Gabarit par défaut des pages de l’application : un titre, puis des lignes. */
export default function Loading() {
  return (
    <PageLoading label="Chargement" width="wide">
      <LoadingBlock className="h-4 w-40" />
      <LoadingBlock className="mt-3 h-9 w-72" />
      <div className="mt-8 space-y-2">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} aria-hidden="true" className="h-11 rounded-md border border-line bg-surface shadow-card" />
        ))}
      </div>
    </PageLoading>
  );
}
