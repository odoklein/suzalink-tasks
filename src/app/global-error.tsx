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
          <div className="w-full max-w-[420px] text-center">
            <h1 className="text-[22px] font-semibold tracking-tight">Une erreur est survenue</h1>
            <p className="mt-2 text-[14px] text-muted">
              L’application a rencontré un problème inattendu. Vos données ne sont pas perdues.
            </p>
            <button
              type="button"
              onClick={() => retry()}
              className="mt-6 inline-flex items-center justify-center rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90"
            >
              Réessayer
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
