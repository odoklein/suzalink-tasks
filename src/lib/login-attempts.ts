/**
 * Limitation des essais de connexion (P1-11).
 *
 * L'essai est réservé AVANT la comparaison bcrypt, de façon atomique (`store.reserve`) :
 * des requêtes parallèles ne peuvent plus dépasser la limite. Ce module ne touche pas à la base ;
 * `src/lib/login-store.ts` fournit l'implémentation SQL, dont la sémantique doit rester celle de
 * `memoryAttemptStore` ci-dessous (utilisé par les tests).
 */

/** Essais permis avant blocage. */
export const MAX_ATTEMPTS = 5;
/** Durée des blocages successifs : 15 min, puis 1 h, puis 24 h. */
export const LOCK_MINUTES = [15, 60, 24 * 60] as const;
/** Le message « Encore N essais avant blocage » apparaît à partir de cet échec. */
export const WARN_FROM_FAILURE = 3;

export type AttemptStore = {
  /** Réserve un essai (+1) si le compte n'est pas bloqué ; `null` s'il l'est. Atomique. */
  reserve(userId: string): Promise<{ count: number } | null>;
  /**
   * Pose le blocage si le seuil est atteint et qu'aucun blocage n'est actif (durée selon le niveau,
   * niveau +1, compteur remis à 0). Atomique. Renvoie la fin du blocage (celui déjà posé, le cas échéant).
   */
  lock(userId: string): Promise<Date>;
  /** Connexion réussie : compteur, blocage et niveau remis à zéro. */
  reset(userId: string): Promise<void>;
  /** Fin du blocage en cours, ou `null`. */
  lockedUntil(userId: string): Promise<Date | null>;
};

export type AttemptOutcome =
  | { kind: "ok" }
  /** `remaining` : essais restants avant blocage, affiché à partir du 3ᵉ échec (sinon `null`). */
  | { kind: "invalid"; remaining: number | null }
  | { kind: "locked"; until: Date };

export function lockMinutesFor(level: number) {
  return LOCK_MINUTES[Math.min(Math.max(level, 0), LOCK_MINUTES.length - 1)];
}

export async function attemptLogin(
  store: AttemptStore,
  userId: string,
  verify: () => Promise<boolean>,
): Promise<AttemptOutcome> {
  const reserved = await store.reserve(userId);
  if (!reserved) return { kind: "locked", until: (await store.lockedUntil(userId)) ?? new Date() };
  // Un essai réservé au-delà de la limite n'est même pas vérifié.
  if (reserved.count > MAX_ATTEMPTS) return { kind: "locked", until: await store.lock(userId) };

  if (await verify()) {
    await store.reset(userId);
    return { kind: "ok" };
  }
  if (reserved.count >= MAX_ATTEMPTS) return { kind: "locked", until: await store.lock(userId) };
  return {
    kind: "invalid",
    remaining: reserved.count >= WARN_FROM_FAILURE ? MAX_ATTEMPTS - reserved.count : null,
  };
}

/** « 15 minutes », « 1 minute », « 1 heure », « 24 heures ». */
export function formatLockDuration(ms: number) {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""}`;
  const hours = Math.ceil(minutes / 60);
  return `${hours} heure${hours > 1 ? "s" : ""}`;
}

export function lockedMessage(until: Date, now = new Date()) {
  return `Trop d’erreurs. Réessayez dans ${formatLockDuration(until.getTime() - now.getTime())}.`;
}

export function invalidMessage(remaining: number | null) {
  if (remaining === null) return "Email ou code incorrect.";
  return `Code incorrect. Encore ${remaining} essai${remaining > 1 ? "s" : ""} avant blocage.`;
}

type MemoryRow = { failedLogins: number; lockedUntil: Date | null; lockLevel: number };

/**
 * Implémentation en mémoire, de référence pour les tests : chaque opération est atomique
 * (synchrone entre deux `await`), comme une requête UPDATE … RETURNING sur une ligne.
 */
export function memoryAttemptStore(rows: Record<string, MemoryRow>, now: () => Date = () => new Date()): AttemptStore {
  const unlocked = (row: MemoryRow) => !row.lockedUntil || row.lockedUntil < now();
  return {
    async reserve(userId) {
      const row = rows[userId];
      if (!unlocked(row)) return null;
      row.failedLogins += 1;
      return { count: row.failedLogins };
    },
    async lock(userId) {
      const row = rows[userId];
      if (row.failedLogins >= MAX_ATTEMPTS && unlocked(row)) {
        row.lockedUntil = new Date(now().getTime() + lockMinutesFor(row.lockLevel) * 60_000);
        row.failedLogins = 0;
        row.lockLevel = Math.min(row.lockLevel + 1, LOCK_MINUTES.length - 1);
      }
      return row.lockedUntil ?? now();
    },
    async reset(userId) {
      rows[userId] = { failedLogins: 0, lockedUntil: null, lockLevel: 0 };
    },
    async lockedUntil(userId) {
      return rows[userId].lockedUntil;
    },
  };
}
