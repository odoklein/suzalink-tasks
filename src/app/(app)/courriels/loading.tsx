import { LoadingBlock, PageLoading } from "@/components/page-loading";

/** Gabarit des E-mails : titre, puis une liste d'échanges. */
export default function Loading() {
  return (
    <PageLoading label="Chargement des e-mails" width="narrow">
      <LoadingBlock className="h-8 w-40" />
      <LoadingBlock className="mt-3 h-4 w-80 max-w-full" />
      <div aria-hidden="true" className="mt-8 divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
        {[0, 1, 2, 3, 4].map((row) => (
          <div key={row} className="flex items-center gap-4 px-4 py-4">
            <LoadingBlock className="h-4 w-16" />
            <LoadingBlock className="h-4 flex-1" />
            <LoadingBlock className="h-4 w-24" />
          </div>
        ))}
      </div>
    </PageLoading>
  );
}
