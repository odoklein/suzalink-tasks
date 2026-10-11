import type { CalendarEvent } from "@/lib/google/calendar";
import { findMeetingLink, type MeetingLink } from "@/lib/meetings/links";

/** Participant tel qu'enregistré dans `Meeting.attendees`. */
export type Attendee = {
  email: string;
  name: string | null;
  organizer: boolean;
  self: boolean;
  responseStatus: string | null;
};

export type MeetingDraft = {
  calendarEventId: string;
  iCalUid: string | null;
  title: string;
  startsAt: Date;
  endsAt: Date;
  attendees: Attendee[];
  internalOnly: boolean;
  link: MeetingLink | null;
};

/** Ce qu'un événement d'agenda devient : une réunion, une annulation, ou rien (journée entière, absence…). */
export type DraftResult = { kind: "meeting"; draft: MeetingDraft } | { kind: "cancelled"; calendarEventId: string } | { kind: "ignored" };

// « fromGmail » : réservations (vols, restaurants) ajoutées par Gmail, pas des réunions.
const IGNORED_TYPES = new Set(["workingLocation", "outOfOffice", "focusTime", "birthday", "fromGmail"]);

const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

/**
 * Événement Google → brouillon de réunion. Module pur.
 * `agencyDomain` (suzaliconseil.com) sert à repérer les réunions internes.
 */
export function toMeetingDraft(event: CalendarEvent, agencyDomain: string): DraftResult {
  if (event.status === "cancelled") return { kind: "cancelled", calendarEventId: event.id };
  if (event.eventType && IGNORED_TYPES.has(event.eventType)) return { kind: "ignored" };
  const start = event.start?.dateTime;
  const end = event.end?.dateTime;
  // Journée entière (start.date) : pas une réunion.
  if (!start || !end) return { kind: "ignored" };

  const attendees: Attendee[] = (event.attendees ?? [])
    .filter((attendee) => attendee.email && !attendee.resource)
    .map((attendee) => ({
      email: attendee.email!.toLowerCase(),
      name: attendee.displayName?.trim() || null,
      organizer: !!attendee.organizer,
      self: !!attendee.self,
      responseStatus: attendee.responseStatus ?? null,
    }));

  // Invitation refusée par le membre : on ne l'enregistre pas pour lui.
  if (attendees.some((attendee) => attendee.self && attendee.responseStatus === "declined")) {
    return { kind: "cancelled", calendarEventId: event.id };
  }

  const domain = agencyDomain.toLowerCase();
  const internalOnly = attendees.every((attendee) => domainOf(attendee.email) === domain);

  return {
    kind: "meeting",
    draft: {
      calendarEventId: event.id,
      iCalUid: event.iCalUID ?? null,
      title: event.summary?.trim() || "(Sans titre)",
      startsAt: new Date(start),
      endsAt: new Date(end),
      attendees,
      internalOnly,
      link: findMeetingLink(event),
    },
  };
}
