import "server-only";

import { Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { LOCK_MINUTES, MAX_ATTEMPTS, type AttemptStore } from "@/lib/login-attempts";

// Les colonnes DateTime de Prisma sont des `timestamp` sans fuseau, en UTC : on compare avec
// l'heure UTC de la base, quel que soit le fuseau de la session.
const NOW = Prisma.raw(`(now() AT TIME ZONE 'UTC')`);
// Constantes du code (pas une saisie) : insérées telles quelles dans le SQL.
const LOCK_MINUTES_SQL = Prisma.raw(
  `CASE "lockLevel" WHEN 0 THEN ${LOCK_MINUTES[0]} WHEN 1 THEN ${LOCK_MINUTES[1]} ELSE ${LOCK_MINUTES[2]} END`,
);
const MAX_LEVEL = Prisma.raw(String(LOCK_MINUTES.length - 1));

/**
 * Compteur d'essais en base. Chaque opération est un seul UPDATE … RETURNING : Postgres verrouille
 * la ligne et réévalue la condition WHERE pour les requêtes concurrentes. Même sémantique que
 * `memoryAttemptStore` (src/lib/login-attempts.ts), qui sert aux tests.
 */
export const prismaAttemptStore: AttemptStore = {
  async reserve(userId) {
    const rows = await db.$queryRaw<{ failedLogins: number }[]>`
      UPDATE "User" SET "failedLogins" = "failedLogins" + 1
      WHERE id = ${userId} AND ("lockedUntil" IS NULL OR "lockedUntil" < ${NOW})
      RETURNING "failedLogins"`;
    return rows[0] ? { count: Number(rows[0].failedLogins) } : null;
  },

  async lock(userId) {
    const rows = await db.$queryRaw<{ lockedUntil: Date }[]>`
      UPDATE "User" SET
        "lockedUntil" = ${NOW} + make_interval(mins => ${LOCK_MINUTES_SQL}),
        "failedLogins" = 0,
        "lockLevel" = LEAST("lockLevel" + 1, ${MAX_LEVEL})
      WHERE id = ${userId}
        AND "failedLogins" >= ${MAX_ATTEMPTS}
        AND ("lockedUntil" IS NULL OR "lockedUntil" < ${NOW})
      RETURNING "lockedUntil"`;
    if (rows[0]) return rows[0].lockedUntil;
    // Une requête concurrente a déjà posé le blocage.
    return (await prismaAttemptStore.lockedUntil(userId)) ?? new Date();
  },

  async reset(userId) {
    await db.user.update({ where: { id: userId }, data: { failedLogins: 0, lockedUntil: null, lockLevel: 0 } });
  },

  async lockedUntil(userId) {
    const user = await db.user.findUnique({ where: { id: userId }, select: { lockedUntil: true } });
    return user?.lockedUntil ?? null;
  },
};
