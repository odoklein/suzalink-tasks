"use server";

import { revalidatePath } from "next/cache";

import { safe } from "@/lib/action";
import { verifySession } from "@/lib/dal";
import { disconnectGoogleAccount } from "@/lib/meetings/accounts";
import { approveCapture, withdrawCapture } from "@/lib/meetings/capture";
import {
  acceptProposals,
  deleteMeetingContent,
  linkProposal,
  retryReport,
  setMeetingProject,
  setProposalIgnored,
  type AcceptProposalInput,
} from "@/lib/meetings/review";
import { runService, ServiceError } from "@/lib/services/core";
import { idSchema } from "@/lib/validation";

/**
 * Réunions : actions fines (session → validation → service → revalidation).
 * Les règles (qui peut enregistrer, preuves, lots) vivent dans src/lib/meetings.
 */

async function webUser() {
  const { userId } = await verifySession();
  return { userId, via: "WEB" as const };
}

function id(value: string) {
  const parsed = idSchema.safeParse(value);
  if (!parsed.success) throw new ServiceError("Réunion introuvable.", "NOT_FOUND");
  return parsed.data;
}

function refresh(meetingId?: string) {
  revalidatePath("/reunions");
  if (meetingId) revalidatePath(`/reunions/${meetingId}`);
}

export async function setMeetingProjectAction(meetingId: string, projectId: string | null) {
  return safe(() =>
    runService(async () => {
      await setMeetingProject(await webUser(), id(meetingId), projectId ? id(projectId) : null);
      refresh(meetingId);
      return { ok: true as const };
    }),
  );
}

/** « Enregistrer cette réunion », après l'avertissement des participants. */
export async function approveRecording(meetingId: string) {
  return safe(() =>
    runService(async () => {
      await approveCapture(await webUser(), id(meetingId));
      refresh(meetingId);
      return { ok: true as const };
    }),
  );
}

/** « Ne pas enregistrer », ou « Arrêter et ne rien garder » pendant la réunion. */
export async function withdrawRecording(meetingId: string) {
  return safe(() =>
    runService(async () => {
      await withdrawCapture(await webUser(), id(meetingId));
      refresh(meetingId);
      return { ok: true as const };
    }),
  );
}

export async function acceptMeetingProposals(meetingId: string, items: AcceptProposalInput[]) {
  return safe(() =>
    runService(async () => {
      const { refs } = await acceptProposals(await webUser(), id(meetingId), items);
      refresh(meetingId);
      revalidatePath("/", "layout");
      return { ok: true as const, refs };
    }),
  );
}

export async function linkMeetingProposal(meetingId: string, proposalId: string, ref: string) {
  return safe(() =>
    runService(async () => {
      const result = await linkProposal(await webUser(), id(proposalId), ref);
      refresh(meetingId);
      return { ok: true as const, ref: result.ref };
    }),
  );
}

export async function ignoreMeetingProposal(meetingId: string, proposalId: string, ignored: boolean) {
  return safe(() =>
    runService(async () => {
      await setProposalIgnored(await webUser(), id(proposalId), ignored);
      refresh(meetingId);
      return { ok: true as const };
    }),
  );
}

export async function retryMeetingReport(meetingId: string) {
  return safe(() =>
    runService(async () => {
      await webUser();
      await retryReport(id(meetingId));
      refresh(meetingId);
      return { ok: true as const };
    }),
  );
}

export async function deleteMeeting(meetingId: string) {
  return safe(() =>
    runService(async () => {
      await deleteMeetingContent(await webUser(), id(meetingId));
      refresh(meetingId);
      return { ok: true as const };
    }),
  );
}

/** Paramètres › Google Agenda › « Déconnecter ». */
export async function disconnectGoogle() {
  return safe(async () => {
    const { userId } = await verifySession();
    await disconnectGoogleAccount(userId);
    revalidatePath("/settings");
    refresh();
    return { ok: true as const };
  });
}
