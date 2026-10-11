import "server-only";

import { integrationEnabled } from "@/lib/env";
import { recordIntegrationSignal } from "@/lib/integration-status";
import { registerDailyStep, registerJobHandler, registerRecurringJobs, type JobHandler } from "@/lib/jobs/handlers";
import { dispatchBot, pollCapture, watchLiveCaptures } from "@/lib/meetings/capture";
import { calendarSyncKey, MEETING_JOBS, watchKey } from "@/lib/meetings/job-kinds";
import { buildReport } from "@/lib/meetings/report";
import { purgeMeetingData } from "@/lib/meetings/retention";
import { syncCalendars } from "@/lib/meetings/sync";
import { fetchTranscript } from "@/lib/meetings/transcript";
import { VexaError } from "@/lib/meetings/vexa";

/** Panneau Intégrations : dernier échange avec le serveur d'enregistrement, réussi ou non. */
function withVexaSignal(handler: JobHandler): JobHandler {
  return async (job) => {
    try {
      await handler(job);
      await recordIntegrationSignal("vexa", { ok: true });
    } catch (error) {
      // Erreur HTTP de Vexa, ou serveur injoignable (fetch lève une TypeError).
      if (error instanceof VexaError || error instanceof TypeError) {
        await recordIntegrationSignal("vexa", { ok: false, error: error.message });
      }
      throw error;
    }
  };
}

/** Branche les Réunions sur la file de travaux (appelé une fois par src/lib/jobs/setup.ts). */
export function registerMeetingJobs() {
  registerJobHandler(MEETING_JOBS.calendarSync, (job) => syncCalendars((job.payload as { accountId?: string }).accountId));
  registerJobHandler(MEETING_JOBS.dispatch, withVexaSignal(dispatchBot));
  registerJobHandler(MEETING_JOBS.poll, withVexaSignal(pollCapture));
  registerJobHandler(MEETING_JOBS.watch, () => watchLiveCaptures());
  registerJobHandler(MEETING_JOBS.transcript, fetchTranscript);
  registerJobHandler(MEETING_JOBS.report, buildReport);

  registerRecurringJobs("meetings", (now) => [
    ...(integrationEnabled("google") ? [{ kind: MEETING_JOBS.calendarSync, dedupeKey: calendarSyncKey(now), runAt: now }] : []),
    ...(integrationEnabled("vexa") ? [{ kind: MEETING_JOBS.watch, dedupeKey: watchKey(now), runAt: now }] : []),
  ]);
  registerDailyStep({ name: "meeting-retention", run: purgeMeetingData });
}
