import "server-only";

import type { GmailPart } from "@/lib/emails/parse";
import { GoogleAuthError } from "@/lib/google/oauth";

/** API Gmail v1 en lecture seule (REST, sans le paquet `googleapis`). */

const BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  internalDate?: string;
  payload?: GmailPart;
};

/** L'accès à Gmail n'a pas été accordé (ou a été retiré) : l'agenda, lui, peut fonctionner. */
export class GmailAccessError extends Error {
  constructor() {
    super("Accès à Gmail non autorisé : reconnectez Gmail dans Paramètres.");
    this.name = "GmailAccessError";
  }
}

async function call(path: string, token: string): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  if (response.status === 401) throw new GoogleAuthError();
  if (response.status === 403) {
    const body = (await response.clone().json().catch(() => null)) as { error?: { errors?: { reason?: string }[] } } | null;
    const reason = body?.error?.errors?.[0]?.reason ?? "";
    if (reason === "insufficientPermissions" || reason === "forbidden") throw new GmailAccessError();
  }
  return response;
}

async function json<T>(path: string, token: string): Promise<T> {
  const response = await call(path, token);
  if (!response.ok) throw new Error(`Gmail : erreur ${response.status}.`);
  return (await response.json()) as T;
}

export const gmailProfile = (token: string) => json<{ emailAddress: string; historyId: string }>("/profile", token);

/** Identifiants des messages correspondant à une recherche Gmail (`q`), du plus récent au plus ancien. */
export async function listMessageIds(token: string, q: string, max = 300): Promise<string[]> {
  const ids: string[] = [];
  let pageToken: string | undefined;
  while (ids.length < max) {
    const params = new URLSearchParams({ q, maxResults: String(Math.min(100, max - ids.length)) });
    if (pageToken) params.set("pageToken", pageToken);
    const page = await json<{ messages?: { id: string }[]; nextPageToken?: string }>(`/messages?${params}`, token);
    ids.push(...(page.messages ?? []).map((message) => message.id));
    pageToken = page.nextPageToken;
    if (!pageToken) break;
  }
  return ids;
}

/**
 * Messages arrivés depuis `startHistoryId`. `expired` : curseur trop ancien
 * (Gmail ne garde l'historique que quelques jours) : il faut relire par recherche.
 */
export async function listHistory(token: string, startHistoryId: string): Promise<{ ids: string[]; historyId: string } | { expired: true }> {
  const ids = new Set<string>();
  let historyId = startHistoryId;
  let pageToken: string | undefined;
  for (let page = 0; page < 10; page++) {
    const params = new URLSearchParams({ startHistoryId, historyTypes: "messageAdded", maxResults: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const response = await call(`/history?${params}`, token);
    if (response.status === 404) return { expired: true };
    if (!response.ok) throw new Error(`Gmail : erreur ${response.status}.`);
    const body = (await response.json()) as {
      history?: { messagesAdded?: { message: { id: string } }[] }[];
      historyId?: string;
      nextPageToken?: string;
    };
    for (const entry of body.history ?? []) for (const added of entry.messagesAdded ?? []) ids.add(added.message.id);
    if (body.historyId) historyId = body.historyId;
    pageToken = body.nextPageToken;
    if (!pageToken) break;
  }
  return { ids: [...ids], historyId };
}

/** Message complet ; null s'il a été supprimé entre-temps. */
export async function getMessage(token: string, id: string): Promise<GmailMessage | null> {
  const response = await call(`/messages/${encodeURIComponent(id)}?format=full`, token);
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Gmail : erreur ${response.status}.`);
  return (await response.json()) as GmailMessage;
}

/** Contenu d'une pièce jointe (base64url), pour une invitation .ics. */
export async function getAttachment(token: string, messageId: string, attachmentId: string): Promise<string | null> {
  const response = await call(`/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`, token);
  if (!response.ok) return null;
  return ((await response.json()) as { data?: string }).data ?? null;
}

/** Lien vers le message dans Gmail (ouvre le fil dans la boîte du membre connecté). */
export const gmailThreadUrl = (threadId: string) => `https://mail.google.com/mail/u/0/#all/${threadId}`;
