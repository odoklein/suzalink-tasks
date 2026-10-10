"use client";

import { useEffect } from "react";

import "./globals.css";

/**
 * Dernier filet : remplace le layout racine, donc son propre <html> et <body>.
 * Aucune dépendance aux polices ni au shell de l’application.
 */
export default function GlobalError({
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
    <html lang="fr">
      <body>
        <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-12">
          <div className="w-full max-w-md text-center">
            <h1 className="text-h2 font-semibold tracking-tight">Une erreur est survenue</h1>
            <p className="mt-2 text-body text-muted">
              L’application a rencontré un problème inattendu. Vos données ne sont pas perdues.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => retry()}
                className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-ui font-medium text-primary-ink transition-opacity hover:opacity-90 pointer-coarse:min-h-11"
              >
                Réessayer
              </button>
              {/* Rechargement complet voulu : l’arbre React vient de planter, un <Link> ne repartirait pas d’une page propre. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a
                href="/"
                className="inline-flex h-8 items-center justify-center rounded-md border border-line bg-surface px-3 text-ui font-medium text-ink-2 hover:border-line-strong hover:text-ink pointer-coarse:min-h-11"
              >
                Retour à Aujourd’hui
              </a>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
