"use client";

import Link from "next/link";
import { useEffect } from "react";

import { PrimaryButton } from "@/components/dialog";

/** Erreur dans une page de l’application : le menu latéral reste affiché. */
export default function AppError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-12">
      <div className="w-full max-w-[420px] text-center">
        <h1 className="font-display text-[22px] font-semibold tracking-tight">Une erreur est survenue</h1>
        <p className="mt-2 text-[14px] text-muted">
          Cette page n’a pas pu s’afficher. Réessayez, ou revenez à Aujourd’hui.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <PrimaryButton type="button" onClick={() => retry()}>
            Réessayer
          </PrimaryButton>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
          >
            Aller à Aujourd’hui
          </Link>
        </div>
      </div>
    </div>
  );
}
