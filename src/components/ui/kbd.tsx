"use client";

import { useSyncExternalStore } from "react";

import { formatKeys } from "@/lib/keys";
import { cn } from "@/lib/utils";

const noop = () => () => {};
const detectMac = () => /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent);

/** Vrai sur macOS et iOS ; faux pendant le rendu serveur, puis corrigé à l’hydratation. */
export function useIsMac() {
  return useSyncExternalStore(noop, detectMac, () => false);
}

/**
 * Touche ou raccourci. `keys="Mod+K"` s’adapte au système (⌘K sur Mac, Ctrl K ailleurs) ;
 * `children` affiche une touche brute (« C »). `onInk` : sur un fond encre (bouton principal,
 * infobulle).
 */
export function Kbd({
  keys,
  children,
  onInk = false,
  className,
}: {
  keys?: string;
  children?: React.ReactNode;
  onInk?: boolean;
  className?: string;
}) {
  const mac = useIsMac();
  return (
    <kbd
      className={cn(
        "inline-flex min-w-5 items-center justify-center rounded-xs px-1 font-mono text-meta font-medium",
        onInk ? "bg-bg/15 text-inherit" : "border border-line bg-surface-2 text-muted",
        className,
      )}
    >
      {keys ? formatKeys(keys, mac) : children}
    </kbd>
  );
}
