import "server-only";

import type { Channel, Prisma } from "@prisma/client";
import type { z } from "zod";

/**
 * Qui agit, et par quel canal. `userId` est nul pour les actions système
 * (cron, webhook de déploiement) ; `via` alimente l'outbox d'événements.
 */
export type Actor = { userId: string | null; via: Channel };

export const webActor = (userId: string): Actor => ({ userId, via: "WEB" });
export const systemActor = (via: Channel = "SYSTEM"): Actor => ({ userId: null, via });

/** Client Prisma utilisable dans une transaction interactive. */
export type Tx = Prisma.TransactionClient;

export type ServiceErrorCode = "INVALID" | "NOT_FOUND" | "FORBIDDEN" | "CONFLICT";

/** Erreur métier attendue : son message (en français) est montré tel quel. */
export class ServiceError extends Error {
  constructor(
    message: string,
    readonly code: ServiceErrorCode = "INVALID",
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Valide une entrée avec zod ; lève une ServiceError lisible sinon. */
export function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new ServiceError(issue?.message && !issue.message.startsWith("Invalid") ? issue.message : "Données invalides.");
  }
  return result.data;
}

/** Résultat d'une action : les clés du succès restent lisibles (undefined) en cas d'erreur. */
export type ServiceFailure<T> = { error: string } & { [K in Exclude<keyof T, "error">]?: undefined };
export type ServiceSuccess<T> = T & { error?: undefined };

/**
 * Exécute un service depuis une Server Action : une ServiceError devient
 * `{ error }`, toute autre erreur remonte (redirections Next comprises).
 */
export async function runService<T extends object>(fn: () => Promise<T>): Promise<ServiceSuccess<T> | ServiceFailure<T>> {
  try {
    return (await fn()) as ServiceSuccess<T>;
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.message } as ServiceFailure<T>;
    throw error;
  }
}

/** Référence lisible d'une tâche : BG-12. */
export const taskRef = (key: string, number: number) => `${key}-${number}`;

const REF = /^([A-Z][A-Z0-9]{0,5})-(\d{1,6})$/i;

/** « bg-12 » → { key: "BG", number: 12 } ; null si ce n'est pas une référence. */
export function parseTaskRef(ref: string): { key: string; number: number } | null {
  const match = REF.exec(ref.trim());
  if (!match) return null;
  return { key: match[1].toUpperCase(), number: Number(match[2]) };
}
