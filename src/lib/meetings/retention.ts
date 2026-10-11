import "server-only";

import { db } from "@/lib/db";
import { deleteRecording, vexaEnabled } from "@/lib/meetings/vexa";

/**
 * Durées de conservation (R6, docs/REUNIONS-PLAN.md) : l'audio sert seulement
 * à refaire une transcription ; la transcription sert de preuve pendant un an.
 * Le compte rendu, les actions et les tâches restent.
 */
export const RECORDING_RETENTION_DAYS = 30;
export const TRANSCRIPT_RETENTION_DAYS = 365;

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 3600_000);

/** Étape quotidienne `meeting-retention`. Idempotente. */
export async function purgeMeetingData() {
  const errors: string[] = [];

  if (vexaEnabled()) {
    const recordings = await db.meeting.findMany({
      where: { recordingKey: { not: null }, recordingPurgedAt: null, endsAt: { lt: daysAgo(RECORDING_RETENTION_DAYS) } },
      select: { id: true, recordingKey: true },
      take: 100,
    });
    for (const meeting of recordings) {
      try {
        await deleteRecording(Number(meeting.recordingKey));
        await db.meeting.update({ where: { id: meeting.id }, data: { recordingPurgedAt: new Date() } });
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
      }
    }
  }

  const old = await db.meeting.findMany({
    where: { segmentsPurgedAt: null, endsAt: { lt: daysAgo(TRANSCRIPT_RETENTION_DAYS) }, segments: { some: {} } },
    select: { id: true },
    take: 500,
  });
  if (old.length) {
    const ids = old.map((meeting) => meeting.id);
    await db.$transaction([
      db.meetingSegment.deleteMany({ where: { meetingId: { in: ids } } }),
      db.meeting.updateMany({ where: { id: { in: ids } }, data: { segmentsPurgedAt: new Date() } }),
    ]);
  }

  if (errors.length) throw new Error(`Suppression d’enregistrements : ${errors.slice(0, 3).join(" · ")}`);
}
