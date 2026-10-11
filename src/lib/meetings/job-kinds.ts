/** Types de travaux des Réunions (table Job), et leurs clés de déduplication. Module pur. */
export const MEETING_JOBS = {
  calendarSync: "calendar_sync",
  dispatch: "meeting_dispatch",
  poll: "meeting_poll",
  watch: "meeting_watch",
  transcript: "meeting_transcript",
  report: "meeting_report",
} as const;

/** Une lecture d'agenda toutes les 5 minutes (heure UTC arrondie). */
export function calendarSyncKey(now: Date): string {
  const slot = new Date(Math.floor(now.getTime() / 300_000) * 300_000);
  return `calsync:${slot.toISOString().slice(0, 16)}`;
}

/** Vérification des robots en cours, toutes les 5 minutes. */
export const watchKey = (now: Date) => calendarSyncKey(now).replace("calsync", "meetwatch");

/** L'envoi du robot dépend de l'heure de début : une réunion déplacée reçoit un nouveau travail. */
export const dispatchKey = (meetingId: string, startsAt: Date) => `bot:${meetingId}:${startsAt.toISOString()}`;

/** Un suivi par réunion et par minute. */
export const pollKey = (meetingId: string, at: Date) => `meetpoll:${meetingId}:${at.toISOString().slice(0, 16)}`;

export const transcriptKey = (meetingId: string, attempt = 0) => `transcript:${meetingId}:${attempt}`;
export const reportKey = (meetingId: string, attempt = 0) => `report:${meetingId}:${attempt}`;
