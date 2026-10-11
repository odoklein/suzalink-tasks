"use client";

import { useTransition } from "react";
import { toast } from "sonner";

type Result = { ok?: boolean; error?: string };
type Success<T> = Extract<T, { ok: true }>;

/**
 * Lance une Server Action des Réunions : erreur en toast, message de réussite
 * facultatif. `pending` reste vrai jusqu'au rendu de la page revalidée.
 */
export function useMeetingAction() {
  const [pending, startTransition] = useTransition();
  const run = <T extends Result>(
    action: () => Promise<T>,
    success?: string | ((result: Success<T>) => string),
    onDone?: (result: Success<T>) => void,
  ) =>
    startTransition(async () => {
      const result = await action();
      if (result.error || !result.ok) {
        toast.error(result.error ?? "Une erreur est survenue. Réessayez.");
        return;
      }
      const ok = result as Success<T>;
      if (success) toast.success(typeof success === "string" ? success : success(ok));
      onDone?.(ok);
    });
  return { pending, run };
}
