import "server-only";

import { unstable_rethrow } from "next/navigation";

/** Message affiché quand une action échoue pour une raison inattendue (base indisponible, etc.). */
export const GENERIC_ERROR = "Une erreur est survenue. Réessayez.";

/** Échec d’une Server Action. `ok` est absent ou faux : `if (!res.ok)` suffit à le distinguer d’un succès. */
export type ActionError = { ok?: false; error: string };

/** Résultat d’une Server Action : `{ ok: true, … }` en cas de succès, `{ error }` sinon. */
export type ActionResult<T extends object = object> = ({ ok: true } & T) | ActionError;

/**
 * Enveloppe le corps d’une Server Action : une exception inattendue devient `{ error }`
 * au lieu d’un écran blanc côté client.
 *
 * Les « exceptions » de contrôle de Next (`redirect()`, `notFound()`, API dynamiques)
 * sont relancées telles quelles grâce à `unstable_rethrow`.
 * Côté client : `if (!res.ok) toast.error(res.error)`.
 */
export async function safe<T>(fn: () => Promise<T>): Promise<T | ActionError> {
  try {
    return await fn();
  } catch (error) {
    unstable_rethrow(error);
    console.error(error);
    return { error: GENERIC_ERROR };
  }
}
