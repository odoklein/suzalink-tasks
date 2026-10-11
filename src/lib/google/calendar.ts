import "server-only";

import { GoogleAuthError } from "@/lib/google/oauth";

/** Champs utiles d'un événement de l'API Calendar v3 (lecture seule). */
export type CalendarEvent = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  description?: string;
  location?: string;
  iCalUID?: string;
  eventType?: string;
  hangoutLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { email?: string; displayName?: string; organizer?: boolean; self?: boolean; resource?: boolean; responseStatus?: string }[];
  organizer?: { email?: string; displayName?: string; self?: boolean };
  conferenceData?: {
    entryPoints?: { entryPointType?: string; uri?: string; passcode?: string; password?: string; meetingCode?: string }[];
  };
};

const BASE = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const FIELDS =
  "items(id,status,summary,description,location,iCalUID,eventType,hangoutLink,start,end,attendees,organizer,conferenceData),nextPageToken";

async function call(url: string, accessToken: string): Promise<Response> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 401) throw new GoogleAuthError();
  if (response.status === 403) {
    throw new GoogleAuthError("Accès à l’agenda refusé : reconnectez le compte Google en autorisant l’agenda.");
  }
  return response;
}

/**
 * Événements de l'agenda principal entre `from` et `to`, occurrences des
 * événements récurrents dépliées, annulations comprises (`showDeleted`).
 * Fenêtre glissante relue à chaque passage : pas de jeton de synchronisation
 * à entretenir, et une fenêtre de 30 jours tient dans une ou deux pages.
 */
export async function listEvents(accessToken: string, from: Date, to: Date): Promise<CalendarEvent[]> {
  const events: CalendarEvent[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({
      singleEvents: "true",
      showDeleted: "true",
      orderBy: "startTime",
      timeMin: from.toISOString(),
      timeMax: to.toISOString(),
      maxResults: "250",
      conferenceDataVersion: "1",
      fields: FIELDS,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await call(`${BASE}?${params}`, accessToken);
    if (!response.ok) throw new Error(`Agenda Google : erreur ${response.status}.`);
    const json = (await response.json()) as { items?: CalendarEvent[]; nextPageToken?: string };
    events.push(...(json.items ?? []));
    pageToken = json.nextPageToken;
    if (!pageToken) break;
  }
  return events;
}

/** Un événement par son identifiant ; null s'il a été supprimé. */
export async function getEvent(accessToken: string, eventId: string): Promise<CalendarEvent | null> {
  const response = await call(`${BASE}/${encodeURIComponent(eventId)}?conferenceDataVersion=1`, accessToken);
  if (response.status === 404 || response.status === 410) return null;
  if (!response.ok) throw new Error(`Agenda Google : erreur ${response.status}.`);
  return (await response.json()) as CalendarEvent;
}
