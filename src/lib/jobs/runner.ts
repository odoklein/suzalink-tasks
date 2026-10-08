import "server-only";

import { getJobHandler } from "@/lib/jobs/handlers";
import { claimJobs, completeJob, ensureRecurringJobs, failJob } from "@/lib/jobs/queue";
import { recurringJobs } from "@/lib/jobs/schedule";
// Branche les consommateurs d'événements et les étapes quotidiennes.
import "@/lib/jobs/setup";

export type TickReport = { claimed: number; done: number; failed: { id: string; kind: string; error: string }[] };

/** Un passage du cron : travaux récurrents, puis jusqu'à `limit` travaux dus. */
export async function runTick(limit = 10, deadline = Date.now() + 50_000): Promise<TickReport> {
  await ensureRecurringJobs(recurringJobs(new Date()));
  const jobs = await claimJobs(limit);
  const report: TickReport = { claimed: jobs.length, done: 0, failed: [] };

  for (const job of jobs) {
    if (Date.now() > deadline) {
      // Plus le temps : le verrou expirera et le travail sera repris au prochain passage.
      break;
    }
    const handler = getJobHandler(job.kind);
    try {
      if (!handler) throw new Error(`Type de travail inconnu : ${job.kind}`);
      await handler(job);
      await completeJob(job.id);
      report.done++;
    } catch (error) {
      await failJob(job, error);
      report.failed.push({ id: job.id, kind: job.kind, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return report;
}
