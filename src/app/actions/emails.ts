"use server";

import { revalidatePath } from "next/cache";

import { safe } from "@/lib/action";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import {
  acceptEmailProposals,
  addSenderAsContact,
  dismissSender,
  linkEmailProposal,
  retryEmailAnalysis,
  setEmailProposalIgnored,
  setEmailRoute,
  type AcceptEmailProposalInput,
} from "@/lib/emails/review";
import { syncMailboxes } from "@/lib/emails/sync";
import { runService, ServiceError } from "@/lib/services/core";
import { idSchema } from "@/lib/validation";

/** E-mails clients : actions fines (session → validation → service → revalidation). */

async function webUser() {
  const { userId } = await verifySession();
  return { userId, via: "WEB" as const };
}

function id(value: string | null) {
  if (value === null) return null;
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new ServiceError("Élément introuvable.", "NOT_FOUND");
  return parsed.data;
}

function refresh(emailId?: string) {
  revalidatePath("/courriels");
  if (emailId) revalidatePath(`/courriels/${emailId}`);
}

export async function setEmailRouteAction(emailId: string, route: { projectId: string | null; clientId: string | null }) {
  return safe(() =>
    runService(async () => {
      await webUser();
      await setEmailRoute(id(emailId)!, { projectId: id(route.projectId), clientId: id(route.clientId) });
      refresh(emailId);
      return { ok: true as const };
    }),
  );
}

export async function acceptEmailProposalsAction(emailId: string, items: AcceptEmailProposalInput[]) {
  return safe(() =>
    runService(async () => {
      const { refs } = await acceptEmailProposals(await webUser(), id(emailId)!, items);
      refresh(emailId);
      revalidatePath("/", "layout");
      return { ok: true as const, refs };
    }),
  );
}

export async function linkEmailProposalAction(emailId: string, proposalId: string, ref: string) {
  return safe(() =>
    runService(async () => {
      const result = await linkEmailProposal(await webUser(), id(proposalId)!, ref);
      refresh(emailId);
      return { ok: true as const, ref: result.ref };
    }),
  );
}

export async function ignoreEmailProposalAction(emailId: string, proposalId: string, ignored: boolean) {
  return safe(() =>
    runService(async () => {
      await setEmailProposalIgnored(await webUser(), id(proposalId)!, ignored);
      refresh(emailId);
      return { ok: true as const };
    }),
  );
}

export async function retryEmailAnalysisAction(emailId: string) {
  return safe(() =>
    runService(async () => {
      await webUser();
      await retryEmailAnalysis(id(emailId)!);
      refresh(emailId);
      return { ok: true as const };
    }),
  );
}

/** « Actualiser » : lit tout de suite un lot de la boîte Gmail du membre. */
export async function refreshMyMailbox() {
  return safe(async () => {
    const { userId } = await verifySession();
    const account = await db.oAuthAccount.findUnique({
      where: { userId_provider: { userId, provider: "google" } },
      select: { id: true, gmailConnectedAt: true, reconnectRequired: true },
    });
    if (!account?.gmailConnectedAt) return { error: "Connectez d’abord Gmail dans Paramètres." };
    if (account.reconnectRequired) return { error: "L’accès Google a été retiré : reconnectez-le dans Paramètres." };
    await syncMailboxes(account.id);
    const after = await db.oAuthAccount.findUnique({ where: { id: account.id }, select: { gmailError: true, gmailPendingIds: true } });
    refresh();
    if (after?.gmailError) return { error: `Lecture de Gmail : ${after.gmailError}` };
    return { ok: true as const, remaining: after?.gmailPendingIds.length ?? 0 };
  });
}

export async function addSenderToClient(email: string, clientId: string) {
  return safe(() =>
    runService(async () => {
      await webUser();
      await addSenderAsContact(email, { clientId: id(clientId)! });
      refresh();
      revalidatePath("/clients");
      return { ok: true as const };
    }),
  );
}

export async function createClientFromSender(email: string, name: string) {
  return safe(() =>
    runService(async () => {
      await webUser();
      await addSenderAsContact(email, { newClientName: name });
      refresh();
      revalidatePath("/", "layout");
      return { ok: true as const };
    }),
  );
}

export async function dismissSenderAction(email: string) {
  return safe(async () => {
    await webUser();
    await dismissSender(email);
    refresh();
    return { ok: true as const };
  });
}
