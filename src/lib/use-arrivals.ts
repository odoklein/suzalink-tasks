"use client";

import { useEffect, useState } from "react";

/** Au-delà, c’est une resynchronisation en masse (import, rechargement) : rien à signaler. */
const MAX_ARRIVALS = 12;
const ARRIVAL_MS = 700;

/**
 * Repère les éléments qui viennent d’arriver quelque part : nouveaux, ou passés dans un autre
 * groupe (`key`, par exemple le statut). Sert à leur donner `animate-arrive`, pour qu’une tâche
 * ne disparaisse pas d’un endroit pour réapparaître ailleurs sans lien visible.
 *
 * `enabled` à false (glisser en cours, déplacement en cours d’enregistrement) met la mémoire à
 * jour sans rien signaler : la carte qu’on vient de poser n’a pas à clignoter une seconde fois.
 * La mémoire est resynchronisée pendant le rendu, comme le fait déjà le tableau avec les données serveur.
 */
export function useArrivals(items: { id: string; key: string }[], enabled = true): ReadonlySet<string> {
  const [known, setKnown] = useState(() => new Map(items.map((item) => [item.id, item.key])));
  const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set());

  const changed = items.filter((item) => known.get(item.id) !== item.key);
  if (changed.length > 0 || known.size !== items.length) {
    setKnown(new Map(items.map((item) => [item.id, item.key])));
    setArrived(
      enabled && changed.length > 0 && changed.length <= MAX_ARRIVALS ? new Set(changed.map((item) => item.id)) : new Set(),
    );
  }

  useEffect(() => {
    if (arrived.size === 0) return;
    const timer = setTimeout(() => setArrived(new Set()), ARRIVAL_MS);
    return () => clearTimeout(timer);
  }, [arrived]);

  return arrived;
}
