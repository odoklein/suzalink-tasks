"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const SETTINGS = "/settings";

/**
 * Code provisoire (donné par un admin) : tant qu'il n'est pas remplacé, seule la page Paramètres
 * s'affiche. Un layout ne connaît pas le chemin et n'est pas rendu de nouveau à chaque navigation :
 * la garde est donc un composant client qui suit `usePathname()`.
 */
export function PinChangeGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const allowed = pathname === SETTINGS;

  useEffect(() => {
    if (!allowed) router.replace(`${SETTINGS}?premiere-connexion=1`);
  }, [allowed, router]);

  return allowed ? children : null;
}
