import "server-only";

import type { Job } from "@prisma/client";

import { dispatchPendingEvents } from "@/lib/jobs/dispatch";

export type JobHandler = (job: Job) => Promise<void>;
export type DailyStep = { name: string; run: (job: Job) => Promise<void> };

/**
 * Étapes du travail quotidien (6 h, Paris). Chaque étape doit être
 * idempotente : en cas d'échec, tout le travail est rejoué.
 * À brancher après fusion : purge des tâches supprimées depuis 30 jours
 * (P3-04), tâches récurrentes (P4-13).
 */
const dailySteps: DailyStep[] = [];

export function registerDailyStep(step: DailyStep) {
  if (!dailySteps.some((existing) => existing.name === step.name)) dailySteps.push(step);
}

const handlers: Record<string, JobHandler> = {
  async dispatch_events() {
    // Plusieurs lots par passage si l'outbox a pris du retard.
    for (let round = 0; round < 5; round++) {
      if ((await dispatchPendingEvents()) < 200) break;
    }
  },
  async daily(job) {
    const errors: string[] = [];
    for (const step of dailySteps) {
      try {
        await step.run(job);
      } catch (error) {
        errors.push(`${step.name} : ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    if (errors.length) throw new Error(errors.join(" · "));
  },
  async digest() {
    // Rempli par P7-04 (récapitulatif hebdomadaire).
  },
};

export function registerJobHandler(kind: string, handler: JobHandler) {
  handlers[kind] = handler;
}

export function getJobHandler(kind: string): JobHandler | undefined {
  return handlers[kind];
}
