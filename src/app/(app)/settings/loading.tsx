import { LoadingBlock, PageLoading } from "@/components/page-loading";

/** Gabarit des paramètres : un titre, puis des sections empilées. */
export default function Loading() {
  return (
    <PageLoading label="Chargement des paramètres" width="narrow">
      <LoadingBlock className="h-8 w-44" />
      <div className="mt-6 space-y-4">
        {[0, 1, 2].map((section) => (
          <div key={section} aria-hidden="true" className="h-32 rounded-lg border border-line bg-surface shadow-card" />
        ))}
      </div>
    </PageLoading>
  );
}
