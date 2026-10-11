import type { MeetingPlatform } from "@prisma/client";

/**
 * Liens de visioconférence reconnus par le robot : Google Meet, Teams, Zoom.
 * Module pur : `nativeMeetingId` et `passcode` sont ce que l'API du robot attend.
 */

export type MeetingLink = {
  platform: MeetingPlatform;
  /** Lien normalisé, sans paramètres de suivi (le code éventuel est gardé à part). */
  url: string;
  nativeMeetingId: string;
  passcode: string | null;
};

const MEET = /^https?:\/\/meet\.google\.com\/([a-z]{3}-[a-z]{4}-[a-z]{3})(?=$|[/?#])/i;
// Teams « nouveau format » (entreprise et grand public) : identifiant numérique + code `p`.
const TEAMS_MEET = /^https?:\/\/teams\.(?:microsoft|live)\.com\/meet\/(\d{9,15})(?=$|[/?#])/i;
// Teams « meetup-join » : l'identifiant est le fil « 19:meeting_…@thread.v2 » du chemin.
const TEAMS_JOIN = /^https?:\/\/teams\.microsoft\.com\/l\/meetup-join\/([^/?#\s]+)/i;
const ZOOM = /^https?:\/\/(?:[\w-]+\.)?zoom\.us\/(?:j|w|wc\/join)\/(\d{9,12})(?=$|[/?#])/i;

/** Lit un lien de réunion ; null s'il n'est pas d'une plateforme prise en charge. */
export function parseMeetingUrl(raw: string): MeetingLink | null {
  const value = raw.trim().replace(/&amp;/g, "&");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const meet = MEET.exec(value);
  if (meet) {
    const id = meet[1].toLowerCase();
    return { platform: "GOOGLE_MEET", url: `https://meet.google.com/${id}`, nativeMeetingId: id, passcode: null };
  }

  const teams = TEAMS_MEET.exec(value);
  if (teams) {
    const passcode = url.searchParams.get("p");
    return { platform: "TEAMS", url: `${url.origin}/meet/${teams[1]}`, nativeMeetingId: teams[1], passcode };
  }

  const join = TEAMS_JOIN.exec(value);
  if (join) {
    let thread: string;
    try {
      thread = decodeURIComponent(join[1]);
    } catch {
      return null;
    }
    if (!/^19:meeting_[^\s?#&=/]+@thread\.v2$/.test(thread)) return null;
    // `context` (locataire, organisateur) sert à rejoindre : le lien est gardé tel quel.
    return { platform: "TEAMS", url: value, nativeMeetingId: thread, passcode: null };
  }

  const zoom = ZOOM.exec(value);
  if (zoom) {
    const passcode = url.searchParams.get("pwd");
    return { platform: "ZOOM", url: `${url.origin}/j/${zoom[1]}`, nativeMeetingId: zoom[1], passcode };
  }

  return null;
}

const URL_IN_TEXT = /https?:\/\/[^\s<>"'()]+/g;

/** Tous les liens d'un texte (description HTML d'un événement comprise). */
export function urlsIn(text: string | null | undefined): string[] {
  if (!text) return [];
  return (text.replace(/&amp;/g, "&").match(URL_IN_TEXT) ?? []).map((url) => url.replace(/[.,;:!?]+$/, ""));
}

type EventLike = {
  conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string; passcode?: string; password?: string }[] };
  hangoutLink?: string;
  location?: string;
  description?: string;
};

/**
 * Lien de réunion d'un événement d'agenda : visioconférence attachée
 * d'abord, puis lieu, puis description. Le premier lien reconnu gagne.
 */
export function findMeetingLink(event: EventLike): MeetingLink | null {
  const entry = event.conferenceData?.entryPoints?.find((point) => point.entryPointType === "video" && point.uri);
  const candidates = [entry?.uri, event.hangoutLink, ...urlsIn(event.location), ...urlsIn(event.description)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    const link = parseMeetingUrl(candidate);
    if (link) {
      // Code fourni à part par la visioconférence attachée (Zoom, Teams).
      const passcode = link.passcode ?? (candidate === entry?.uri ? (entry.passcode ?? entry.password ?? null) : null);
      return { ...link, passcode };
    }
  }
  return null;
}
