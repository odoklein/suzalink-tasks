import "server-only";

import { db } from "@/lib/db";
import { startGmailSync } from "@/lib/emails/sync";
import { GMAIL_SCOPE, revokeToken } from "@/lib/google/oauth";
import { enqueueJob } from "@/lib/jobs/queue";
import { MEETING_JOBS } from "@/lib/meetings/job-kinds";
import { syncCalendars } from "@/lib/meetings/sync";
import { open, seal } from "@/lib/secret-box";

type GoogleGrant = {
  sub: string;
  email: string;
  scopes: string[];
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
};

/**
 * Relie le compte Google d'un membre (un par membre) et lance une première
 * lecture de l'agenda ; si Gmail vient d'être autorisé, sa première lecture aussi.
 */
export async function linkGoogleAccount(userId: string, grant: GoogleGrant): Promise<"ok" | "deja-relie"> {
  const other = await db.oAuthAccount.findUnique({
    where: { provider_providerAccountId: { provider: "google", providerAccountId: grant.sub } },
    select: { userId: true },
  });
  if (other && other.userId !== userId) return "deja-relie";
  const previous = await db.oAuthAccount.findUnique({
    where: { userId_provider: { userId, provider: "google" } },
    select: { gmailConnectedAt: true, providerAccountId: true },
  });
  const sameAccount = previous?.providerAccountId === grant.sub;
  const gmail = grant.scopes.includes(GMAIL_SCOPE);
  // Seuls les e-mails reçus après l'autorisation sont lus par l'IA (pas tout l'historique).
  const gmailConnectedAt = gmail ? ((sameAccount && previous?.gmailConnectedAt) || new Date()) : null;

  const tokens = {
    providerAccountId: grant.sub,
    email: grant.email,
    scopes: grant.scopes,
    refreshTokenEnc: seal(grant.refreshToken),
    accessTokenEnc: seal(grant.accessToken),
    expiresAt: new Date(Date.now() + grant.expiresIn * 1000),
    reconnectRequired: false,
    lastError: null,
    lastErrorAt: null,
    gmailConnectedAt,
    // Autre compte Google, ou Gmail retiré : le curseur et la file repartent de zéro.
    ...(!gmail || !sameAccount ? { gmailHistoryId: null, gmailPendingIds: [], gmailError: null } : {}),
  };
  const account = await db.oAuthAccount.upsert({
    where: { userId_provider: { userId, provider: "google" } },
    create: { userId, provider: "google", ...tokens },
    update: tokens,
    select: { id: true },
  });
  // Première lecture tout de suite, sans attendre le cron ; en cas d'échec, la file la refera.
  try {
    await syncCalendars(account.id);
  } catch (error) {
    console.error("calendar-sync-on-connect", error);
    await enqueueJob(MEETING_JOBS.calendarSync, { accountId: account.id }, { dedupeKey: `calsync:connect:${account.id}:${Date.now()}` });
  }
  if (gmail && !(sameAccount && previous?.gmailConnectedAt)) {
    try {
      await startGmailSync(account.id);
    } catch (error) {
      // Le prochain passage du cron reprendra (pas de curseur : nouvelle première lecture).
      console.error("gmail-start", error);
    }
  }
  return "ok";
}

/**
 * Déconnexion : l'accès est révoqué chez Google et le compte supprimé.
 * Plus personne ne verra les annulations de cet agenda : les enregistrements
 * validés à venir sont retirés, et les réunions à venir sans enregistrement
 * ni compte rendu disparaissent. Le passé reste.
 */
export async function disconnectGoogleAccount(userId: string) {
  const account = await db.oAuthAccount.findUnique({ where: { userId_provider: { userId, provider: "google" } } });
  if (!account) return;
  try {
    await revokeToken(open(account.refreshTokenEnc));
  } catch {
    // Clé changée ou jeton illisible : on supprime quand même.
  }
  const now = new Date();
  await db.$transaction([
    db.meeting.updateMany({
      where: { oauthAccountId: account.id, startsAt: { gt: now }, captureStatus: "APPROVED" },
      data: { captureStatus: "CANCELLED", captureError: "Agenda Google déconnecté : enregistrement retiré." },
    }),
    db.meeting.deleteMany({
      where: { oauthAccountId: account.id, startsAt: { gt: now }, captureStatus: { in: ["OFF", "CANCELLED"] }, reportStatus: "NONE" },
    }),
    db.oAuthAccount.delete({ where: { id: account.id } }),
  ]);
}
