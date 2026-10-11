"use client";

import { createContext, useCallback, useContext, useState } from "react";

const AnnounceContext = createContext<(text: string) => void>(() => {});

/**
 * Annonce un message aux lecteurs d’écran sans rien afficher : un déplacement, un changement de
 * statut, un enregistrement. Pour une confirmation que l’œil voit déjà (lavis, carte qui arrive),
 * c’est l’équivalent sonore ; les erreurs, elles, passent par `toast.error` ou `role="alert"`.
 */
export function useAnnounce() {
  return useContext(AnnounceContext);
}

/** Une seule zone `role="status"` pour toute l’application ; `announce` garde la même identité. */
export function Announcer({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState("");
  // Deux annonces identiques de suite ne changeraient pas le texte : un espace insécable les distingue.
  const announce = useCallback((text: string) => setMessage((current) => (current === text ? `${text} ` : text)), []);

  return (
    <AnnounceContext.Provider value={announce}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {message}
      </div>
    </AnnounceContext.Provider>
  );
}
