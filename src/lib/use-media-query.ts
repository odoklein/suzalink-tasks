"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Suit une media query. Côté serveur : false ; le client corrige à l’hydratation, sans erreur
 * d’hydratation (même mécanisme que useReducedMotion).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
