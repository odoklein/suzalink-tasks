import "server-only";

import type { Job, Prisma } from "@prisma/client";

import { db } from "@/lib/db";
import { MAX_ATTEMPTS, nextRunAfterFailure, STALE_LOCK_MINUTES, type RecurringJob } from "@/lib/jobs/schedule";

/** Ajoute un travail ; avec `dedupeKey`, un doublon est ignoré silencieusement. */
export async function enqueueJob(
  kind: string,
  payload: Record<string, unknown> = {},
  options: { runAt?: Date; dedupeKey?: string } = {},
) {
  await db.job.createMany({
    data: [{ kind, payload: payload as Prisma.InputJsonValue, runAt: options.runAt ?? new Date(), dedupeKey: options.dedupeKey }],
    skipDuplicates: true,
  });
}

export async function ensureRecurringJobs(jobs: RecurringJob[]) {
  await db.job.createMany({
    data: jobs.map((job) => ({
      kind: job.kind,
      dedupeKey: job.dedupeKey,
      runAt: job.runAt,
      payload: (job.payload ?? {}) as Prisma.InputJsonValue,
    })),
    skipDuplicates: true,
  });
}

/**
 * Réserve jusqu'à `limit` travaux dus. `FOR UPDATE SKIP LOCKED` : deux
 * passages simultanés du cron ne prennent jamais le même travail.
 */
export async function claimJobs(limit = 10): Promise<Job[]> {
  return db.$queryRaw<Job[]>`
    UPDATE "Job" SET "lockedAt" = now(), "attempts" = "attempts" + 1
    WHERE id IN (
      SELECT id FROM "Job"
      WHERE "doneAt" IS NULL
        AND "runAt" <= now()
        AND "attempts" < ${MAX_ATTEMPTS}
        AND ("lockedAt" IS NULL OR "lockedAt" < now() - make_interval(mins => ${STALE_LOCK_MINUTES}))
      ORDER BY "runAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING *`;
}

export async function completeJob(id: string) {
  await db.job.update({ where: { id }, data: { doneAt: new Date(), lockedAt: null, lastError: null } });
}

export async function failJob(job: Job, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  await db.job.update({
    where: { id: job.id },
    data: { lockedAt: null, lastError: message.slice(0, 2000), runAt: nextRunAfterFailure(new Date(), job.attempts) },
  });
}

/** « Relancer » depuis Paramètres › Intégrations. */
export async function retryJob(id: string) {
  await db.job.update({ where: { id }, data: { attempts: 0, runAt: new Date(), lockedAt: null } });
}

/** Travaux en échec (définitif ou en attente de nouvelle tentative). */
export function failedJobs(take = 20) {
  return db.job.findMany({
    where: { doneAt: null, lastError: { not: null } },
    orderBy: { runAt: "desc" },
    take,
  });
}
