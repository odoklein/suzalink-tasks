"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recharge les données de la page tant qu'un traitement de fond est en cours (robot, transcription, compte rendu). */
export function AutoRefresh({ active, everyMs = 15_000 }: { active: boolean; everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, everyMs);
    return () => window.clearInterval(timer);
  }, [active, everyMs, router]);
  return null;
}
