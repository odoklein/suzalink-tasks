import { TZDate } from "@date-fns/tz";

import { TZ } from "@/lib/time";

/**
 * Lecture d'un e-mail Gmail (format « full ») : en-têtes, adresses, texte
 * sans l'historique cité, invitation d'agenda. Module pur, sans réseau.
 */

export type GmailHeader = { name: string; value: string };
export type GmailPart = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { size?: number; data?: string; attachmentId?: string };
  parts?: GmailPart[];
};

export type Address = { email: string; name: string | null };

export function header(headers: GmailHeader[] | undefined, name: string): string | null {
  const wanted = name.toLowerCase();
  return headers?.find((item) => item.name.toLowerCase() === wanted)?.value ?? null;
}

/** « "Cervi, Luna" <luna@33degres.fr>, b@y.fr » → adresses (virgules entre guillemets respectées). */
export function parseAddressList(value: string | null | undefined): Address[] {
  if (!value) return [];
  const items: string[] = [];
  let current = "";
  let quoted = false;
  let angle = false;
  for (const char of value) {
    if (char === '"') quoted = !quoted;
    else if (char === "<") angle = true;
    else if (char === ">") angle = false;
    if ((char === "," || char === ";") && !quoted && !angle) {
      items.push(current);
      current = "";
    } else current += char;
  }
  items.push(current);

  const addresses: Address[] = [];
  for (const raw of items) {
    const item = raw.trim();
    if (!item) continue;
    const angled = /^(.*?)<([^<>\s]+@[^<>\s]+)>\s*$/.exec(item);
    const email = (angled ? angled[2] : item).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
    const name = angled ? angled[1].trim().replace(/^"(.*)"$/, "$1").trim() : "";
    addresses.push({ email, name: name && name.toLowerCase() !== email ? name : null });
  }
  return addresses;
}

/** Contenu d'une partie (base64url, déjà décodé du transfert par Gmail) dans son jeu de caractères. */
export function decodeBody(data: string | undefined, contentType: string | null = null): string {
  if (!data) return "";
  const bytes = Buffer.from(data, "base64url");
  const charset = /charset="?([\w-]+)"?/i.exec(contentType ?? "")?.[1]?.toLowerCase() ?? "utf-8";
  try {
    return new TextDecoder(charset).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

const ENTITIES: Record<string, string> = { nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", eacute: "é", egrave: "è", agrave: "à", ccedil: "ç", rsquo: "’", hellip: "…" };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/** HTML → texte lisible ; les liens gardent leur adresse (« texte (https://…) ») pour repérer les visios. */
export function htmlToText(html: string): string {
  const text = html
    .replace(/<(head|style|script|title)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_match, href: string, inner: string) => {
      const label = inner.replace(/<[^>]+>/g, "").trim();
      return label && !label.includes(href) && /^https?:/i.test(href) ? `${label} (${href})` : label || href;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "");
  return decodeEntities(text)
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function walk(part: GmailPart | undefined, visit: (part: GmailPart) => void) {
  if (!part) return;
  visit(part);
  for (const child of part.parts ?? []) walk(child, visit);
}

/** Texte du message : la partie text/plain, sinon le HTML converti. Les pièces jointes sont ignorées. */
export function extractText(payload: GmailPart | undefined): string {
  let plain: GmailPart | null = null;
  let html: GmailPart | null = null;
  walk(payload, (part) => {
    if (part.filename) return;
    if (!plain && part.mimeType === "text/plain" && part.body?.data) plain = part;
    if (!html && part.mimeType === "text/html" && part.body?.data) html = part;
  });
  const pick = (part: GmailPart) => decodeBody(part.body?.data, header(part.headers, "Content-Type"));
  if (plain) return pick(plain).replace(/\r\n/g, "\n").trim();
  if (html) return htmlToText(pick(html));
  return "";
}

/** Partie text/calendar (invitation) : en ligne, ou pièce jointe à télécharger (`attachmentId`). */
export function findCalendarPart(payload: GmailPart | undefined): GmailPart | null {
  let found: GmailPart | null = null;
  walk(payload, (part) => {
    if (!found && (part.mimeType === "text/calendar" || part.mimeType === "application/ics" || /\.ics$/i.test(part.filename ?? ""))) found = part;
  });
  return found;
}

const REPLY_MARKERS = [
  // Gmail français : « Le lun. 12 oct. 2026 à 10:00, Luna <luna@…> a écrit : » (parfois sur deux lignes)
  /^Le .{4,250}\n?.{0,120}a écrit\s?:\s*$/m,
  /^On .{4,250}\n?.{0,120}wrote:\s*$/m,
  /^-{2,}\s*(Original Message|Message d['’]origine|Forwarded message|Message transféré)\s*-{2,}/im,
  // Outlook : bloc « De : … / Envoyé : … »
  /^(De|From)\s?:\s.+\n(Envoyé|Sent|Date)\s?:/m,
  /^_{10,}\s*$/m,
];

/** Retire l'historique cité (réponses, transferts) et la signature « -- ». */
export function stripQuotedReply(text: string): string {
  let cut = text.length;
  for (const marker of REPLY_MARKERS) {
    const match = marker.exec(text);
    if (match && match.index < cut) cut = match.index;
  }
  // Bloc cité « > … » précédé d'une ligne vide.
  const quoted = /\n\s*\n(>.*(\n|$)){2,}/.exec(text);
  if (quoted && quoted.index < cut) cut = quoted.index;
  let body = text.slice(0, cut);
  const signature = body.search(/\n-- ?\n/);
  if (signature >= 0) body = body.slice(0, signature);
  return body.trim();
}

const SKIPPED_LABELS = new Set(["SPAM", "TRASH", "DRAFT", "CHAT", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS", "CATEGORY_UPDATES"]);
const ROBOT_SENDER = /^(no-?reply|donotreply|do-not-reply|notifications?|notify|mailer-daemon|postmaster|bounces?|alerts?)([+._-]|@|$)/i;

/** Lettre d'information, notification, réponse automatique… : ni rattaché, ni compté. */
export function isAutomated(input: { headers: GmailHeader[] | undefined; fromEmail: string; labelIds?: string[] }): boolean {
  if ((input.labelIds ?? []).some((label) => SKIPPED_LABELS.has(label))) return true;
  if (ROBOT_SENDER.test(input.fromEmail)) return true;
  if (header(input.headers, "List-Unsubscribe") || header(input.headers, "List-Id")) return true;
  const auto = header(input.headers, "Auto-Submitted");
  if (auto && auto.toLowerCase() !== "no") return true;
  const precedence = header(input.headers, "Precedence")?.toLowerCase();
  return precedence === "bulk" || precedence === "list" || precedence === "junk";
}

export type CalendarInvite = { method: string | null; uid: string; summary: string | null; start: Date; end: Date | null; location: string | null; description: string | null };

function icsDate(value: string, params: string): Date | null {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/.exec(value.trim());
  if (!match) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = match;
  const parts = [Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)] as const;
  if (z) return new Date(Date.UTC(...parts));
  // Heure locale du fuseau indiqué (TZID), ou de Paris par défaut.
  const zone = /TZID=([^;:]+)/i.exec(params)?.[1]?.replace(/^"|"$/g, "") ?? TZ;
  let local = Number.NaN;
  try {
    local = new TZDate(...parts, zone).getTime();
  } catch {
    // Fuseau inconnu : Paris.
  }
  return new Date(Number.isNaN(local) ? new TZDate(...parts, TZ).getTime() : local);
}

const unescapeIcs = (value: string) => value.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1");

/** Première VEVENT d'un fichier .ics (invitation). Null si illisible. */
export function parseIcs(text: string): CalendarInvite | null {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  let method: string | null = null;
  let inEvent = false;
  const fields: Record<string, { params: string; value: string }> = {};
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") inEvent = true;
    else if (line === "END:VEVENT") break;
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    const [name, ...params] = line.slice(0, colon).split(";");
    const value = line.slice(colon + 1);
    if (!inEvent && name.toUpperCase() === "METHOD") method = value.trim().toUpperCase();
    if (inEvent && !fields[name.toUpperCase()]) fields[name.toUpperCase()] = { params: params.join(";"), value };
  }
  const uid = fields.UID?.value.trim();
  const start = fields.DTSTART ? icsDate(fields.DTSTART.value, fields.DTSTART.params) : null;
  if (!uid || !start) return null;
  return {
    method,
    uid,
    summary: fields.SUMMARY ? unescapeIcs(fields.SUMMARY.value).trim() : null,
    start,
    end: fields.DTEND ? icsDate(fields.DTEND.value, fields.DTEND.params) : null,
    location: fields.LOCATION ? unescapeIcs(fields.LOCATION.value) : null,
    description: fields.DESCRIPTION ? unescapeIcs(fields.DESCRIPTION.value) : null,
  };
}
