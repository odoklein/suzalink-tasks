import "server-only";

import { Prisma, type OAuthAccount } from "@prisma/client";

import { db } from "@/lib/db";
import { getEnv, integrationEnabled } from "@/lib/env";
import { decodeBody, extractText, findCalendarPart, header, isAutomated, parseAddressList, parseIcs, stripQuotedReply, type Address } from "@/lib/emails/parse";
import { routeEmail } from "@/lib/emails/routing";
import { accessTokenFor } from "@/lib/google/accounts";
import { getAttachment, getMessage, gmailProfile, GmailAccessError, listHistory, listMessageIds, type GmailMessage } from "@/lib/google/gmail";
import { GoogleAuthError } from "@/lib/google/oauth";
import { recordIntegrationSignal } from "@/lib/integration-status";
import { enqueueJob } from "@/lib/jobs/queue";
import { domainOf, isAgencyEmail, type Agency } from "@/lib/meetings/agency";
import { findMeetingLink } from "@/lib/meetings/links";
import type { MatchContact, MatchProject } from "@/lib/meetings/matching";

/**
 * Lecture de Gmail (lecture seule), par petits lots : un curseur d'historique
 * repère les nouveaux messages, mis en file sur le compte, puis lus quelques-uns
 * à chaque passage du cron (les fonctions Netlify sont coupées au bout de
 * quelques secondes). Un e-mail rattaché à un client est gardé ; un inconnu
 * n'est qu'un compteur. Lettres d'information et notifications sont ignorées.
 */

export const EMAIL_JOBS = { sync: "gmail_sync", analyze: "email_analyze" } as const;

/** Première lecture : 30 jours, sans les catégories promotions / réseaux / forums. */
const INITIAL_QUERY = "newer_than:30d -in:chats -category:promotions -category:social -category:forums";
const RECOVERY_QUERY = "newer_than:3d -in:chats -category:promotions -category:social -category:forums";
const MAX_PENDING = 500;
/** Par passage et par compte : de quoi rester sous la limite de temps des fonctions. */
const BATCH = 12;
const BUDGET_MS = 7_000;
const MAX_BODY = 20_000;

type Context = { contacts: MatchContact[]; projects: MatchProject[]; agency: Agency };

async function loadContext(): Promise<Context> {
  const [contacts, projects, members, accounts] = await Promise.all([
    db.contact.findMany({ where: { email: { not: null } }, select: { email: true, clientId: true } }),
    db.project.findMany({ where: { archived: false, status: { not: "DONE" } }, select: { id: true, key: true, name: true, clientId: true } }),
    db.user.findMany({ select: { email: true } }),
    db.oAuthAccount.findMany({ select: { email: true } }),
  ]);
  const memberEmails = new Set([...members, ...accounts].map((row) => row.email.toLowerCase()));
  return { contacts, projects, agency: { domain: getEnv().AGENCY_DOMAIN, memberEmails } };
}

/** Juste après « Connecter Gmail » : les 30 derniers jours en file, et le curseur d'historique. */
export async function startGmailSync(accountId: string) {
  const account = await db.oAuthAccount.findUniqueOrThrow({ where: { id: accountId } });
  const token = await accessTokenFor(account);
  const [profile, ids] = await Promise.all([gmailProfile(token), listMessageIds(token, INITIAL_QUERY, 300)]);
  await db.oAuthAccount.update({
    where: { id: accountId },
    // Les plus anciens d'abord : un fil se rattache avant ses réponses.
    data: { gmailHistoryId: profile.historyId, gmailPendingIds: ids.reverse(), gmailError: null },
  });
}

/** Ajoute des messages à relire (un interlocuteur vient de devenir contact, par exemple). */
export async function queueGmailSearch(query: string) {
  const accounts = await db.oAuthAccount.findMany({ where: { gmailConnectedAt: { not: null }, reconnectRequired: false } });
  for (const account of accounts) {
    try {
      const token = await accessTokenFor(account);
      const ids = (await listMessageIds(token, query, 100)).reverse();
      const pending = [...new Set([...ids, ...account.gmailPendingIds])].slice(0, MAX_PENDING);
      await db.oAuthAccount.update({ where: { id: account.id }, data: { gmailPendingIds: pending } });
    } catch (error) {
      console.error("gmail-queue", account.email, error);
    }
  }
}

async function calendarText(token: string, message: GmailMessage): Promise<string | null> {
  const part = findCalendarPart(message.payload);
  if (!part) return null;
  if (part.body?.data) return decodeBody(part.body.data, header(part.headers, "Content-Type"));
  if (part.body?.attachmentId) {
    const data = await getAttachment(token, message.id, part.body.attachmentId);
    return data ? decodeBody(data) : null;
  }
  return null;
}

/** Compteurs d'un interlocuteur inconnu (jamais le contenu). */
async function countUnknown(addresses: Address[], direction: "IN" | "OUT", at: Date) {
  for (const address of addresses) {
    await db.emailSender.upsert({
      where: { email: address.email },
      create: {
        email: address.email,
        name: address.name,
        domain: domainOf(address.email),
        received: direction === "IN" ? 1 : 0,
        sent: direction === "OUT" ? 1 : 0,
        firstSeenAt: at,
        lastSeenAt: at,
      },
      update: {
        ...(address.name ? { name: address.name } : {}),
        ...(direction === "IN" ? { received: { increment: 1 } } : { sent: { increment: 1 } }),
        lastSeenAt: at,
      },
    });
  }
}

/** Lit un message, le rattache (ou compte l'inconnu). */
async function processMessage(account: OAuthAccount, token: string, id: string, context: Context) {
  if (await db.emailMessage.findUnique({ where: { oauthAccountId_gmailMessageId: { oauthAccountId: account.id, gmailMessageId: id } }, select: { id: true } })) return;
  const message = await getMessage(token, id);
  if (!message?.payload) return;
  const headers = message.payload.headers;
  const from = parseAddressList(header(headers, "From"))[0];
  if (!from || isAutomated({ headers, fromEmail: from.email, labelIds: message.labelIds })) return;

  const rfcMessageId = header(headers, "Message-ID")?.trim() || null;
  if (rfcMessageId && (await db.emailMessage.findUnique({ where: { rfcMessageId }, select: { id: true } }))) return;

  const recipients = [...parseAddressList(header(headers, "To")), ...parseAddressList(header(headers, "Cc"))];
  const isMember = (email: string) => isAgencyEmail(email, context.agency) || email === account.email.toLowerCase();
  const direction = message.labelIds?.includes("SENT") || isMember(from.email) ? "OUT" : "IN";
  const external = (direction === "IN" ? [from, ...recipients] : recipients).filter((address) => !isMember(address.email));
  if (external.length === 0) return; // échange interne à l'agence

  const sentAt = message.internalDate ? new Date(Number(message.internalDate)) : new Date(header(headers, "Date") ?? Date.now());
  const subject = (header(headers, "Subject") ?? "").trim() || "(Sans objet)";
  const previous = await db.emailMessage.findFirst({
    where: { gmailThreadId: message.threadId, clientId: { not: null } },
    orderBy: { sentAt: "desc" },
    select: { clientId: true, projectId: true },
  });
  const route = routeEmail(
    { participants: external.map((address) => address.email), subject, thread: previous?.clientId ? { clientId: previous.clientId, projectId: previous.projectId } : null },
    context.contacts,
    context.projects,
  );

  if (!route) {
    // Inconnu : seulement des compteurs, pour proposer un nouveau contact.
    await countUnknown(direction === "IN" ? [from] : external, direction, sentAt);
    return;
  }

  const body = stripQuotedReply(extractText(message.payload)).slice(0, MAX_BODY);
  const analyze =
    direction === "IN" &&
    !!body &&
    integrationEnabled("mistral") &&
    !!account.gmailConnectedAt &&
    sentAt >= account.gmailConnectedAt;

  let email;
  try {
    email = await db.emailMessage.create({
      data: {
        gmailMessageId: message.id,
        gmailThreadId: message.threadId,
        rfcMessageId,
        direction,
        fromEmail: from.email,
        fromName: from.name,
        toEmails: recipients.map((address) => address.email),
        subject: subject.slice(0, 500),
        snippet: message.snippet?.slice(0, 300) ?? null,
        sentAt,
        bodyText: body || null,
        meetingLink: findMeetingLink({ description: body })?.url ?? null,
        routedBy: route.by,
        analysis: analyze ? "PENDING" : "NONE",
        oauthAccountId: account.id,
        clientId: route.clientId,
        projectId: route.projectId,
      },
      select: { id: true },
    });
  } catch (error) {
    // Déjà enregistré depuis la boîte d'un autre membre (même Message-ID).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return;
    throw error;
  }
  if (analyze) await enqueueJob(EMAIL_JOBS.analyze, { emailId: email.id }, { dedupeKey: `email:${email.id}` });

  // Invitation jointe (.ics) d'un client, absente des agendas : réunion proposée, à confirmer.
  const ics = await calendarText(token, message);
  const invite = ics ? parseIcs(ics) : null;
  if (invite && invite.method !== "CANCEL" && invite.start > new Date()) {
    const known = await db.meeting.findFirst({ where: { iCalUid: invite.uid }, select: { id: true } });
    const link = findMeetingLink({ location: invite.location ?? undefined, description: `${invite.description ?? ""}\n${body}` });
    if (!known) {
      await db.meeting.create({
        data: {
          title: (invite.summary ?? subject).slice(0, 300),
          startsAt: invite.start,
          endsAt: invite.end && invite.end > invite.start ? invite.end : new Date(invite.start.getTime() + 30 * 60_000),
          iCalUid: invite.uid,
          platform: link?.platform ?? null,
          joinUrl: link?.url ?? null,
          nativeMeetingId: link?.nativeMeetingId ?? null,
          passcode: link?.passcode ?? null,
          attendees: [from, ...recipients].map((address) => ({ email: address.email, name: address.name, organizer: address.email === from.email, self: address.email === account.email.toLowerCase(), responseStatus: null })),
          source: "email",
          emailMessageId: email.id,
          oauthAccountId: account.id,
          projectId: route.projectId,
          projectSuggestedBy: route.projectId ? "email" : null,
        },
      });
    }
  }
}

/** Un passage pour un compte : nouveaux messages en file, puis un lot lu. */
export async function syncMailbox(account: OAuthAccount, deadline: number) {
  const token = await accessTokenFor(account);
  let pending = account.gmailPendingIds;
  let historyId = account.gmailHistoryId;

  if (!historyId) {
    await startGmailSync(account.id);
    return;
  }
  const history = await listHistory(token, historyId);
  if ("expired" in history) {
    const [profile, ids] = await Promise.all([gmailProfile(token), listMessageIds(token, RECOVERY_QUERY, 200)]);
    historyId = profile.historyId;
    pending = [...new Set([...pending, ...ids.reverse()])];
  } else {
    historyId = history.historyId;
    pending = [...new Set([...pending, ...history.ids])];
  }
  pending = pending.slice(-MAX_PENDING);

  const context = await loadContext();
  const done: string[] = [];
  const errors: string[] = [];
  for (const id of pending.slice(0, BATCH)) {
    if (Date.now() > deadline) break;
    try {
      await processMessage(account, token, id, context);
    } catch (error) {
      if (error instanceof GoogleAuthError || error instanceof GmailAccessError) throw error;
      // Un message illisible ne bloque pas la file : il est écarté, l'erreur notée.
      errors.push(error instanceof Error ? error.message : String(error));
    }
    done.push(id);
  }

  await db.oAuthAccount.update({
    where: { id: account.id },
    data: {
      gmailHistoryId: historyId,
      gmailPendingIds: pending.filter((id) => !done.includes(id)),
      gmailSyncedAt: new Date(),
      gmailError: errors.length ? errors[0].slice(0, 500) : null,
    },
  });
}

/** Travail `gmail_sync` : chaque compte avec Gmail, dans le temps imparti. */
export async function syncMailboxes(accountId?: string) {
  const accounts = await db.oAuthAccount.findMany({
    where: { gmailConnectedAt: { not: null }, reconnectRequired: false, ...(accountId ? { id: accountId } : {}) },
  });
  const deadline = Date.now() + BUDGET_MS;
  const errors: string[] = [];
  for (const account of accounts) {
    if (Date.now() > deadline) break;
    try {
      await syncMailbox(account, deadline);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${account.email} : ${message}`);
      await db.oAuthAccount.update({
        where: { id: account.id },
        data: {
          gmailError: message.slice(0, 500),
          // Gmail retiré chez Google : on arrête de le lire, l'agenda continue.
          ...(error instanceof GmailAccessError ? { gmailConnectedAt: null } : {}),
        },
      });
    }
  }
  if (accounts.length > 0) await recordIntegrationSignal("gmail", errors.length ? { ok: false, error: errors.join(" · ") } : { ok: true });
}
