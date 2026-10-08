import type { TaskStatus } from "@prisma/client";

import { formatParis } from "@/lib/time";

/**
 * Relancer le client (P4-05) : règle « à relancer », libellés et message de
 * relance prêt à envoyer. Module pur.
 */

/** Délai avant la première relance, puis entre deux relances (deviendra un réglage de projet). */
export const CHASE_AFTER_DAYS = 5;
const DAY_MS = 86_400_000;
const NNBSP = " ";

export type WaitingTask = {
  status: TaskStatus;
  statusChangedAt: Date;
  waitingSince: Date | null;
  lastChasedAt: Date | null;
  followUpAt?: Date | null;
};

/** Début de l'attente : `waitingSince`, sinon `statusChangedAt` pour les anciennes tâches. */
export const waitingStart = (task: Pick<WaitingTask, "waitingSince" | "statusChangedAt">) =>
  task.waitingSince ?? task.statusChangedAt;

/** `max(waitingSince, lastChasedAt)` : le dernier moment où la balle a été renvoyée au client. */
export function chaseReference(task: Pick<WaitingTask, "waitingSince" | "statusChangedAt" | "lastChasedAt">): Date {
  const start = waitingStart(task);
  return task.lastChasedAt && task.lastChasedAt > start ? task.lastChasedAt : start;
}

/**
 * Date à laquelle la tâche devient « à relancer » : référence + 5 jours, sauf
 * si une date de relance plus récente que la dernière relance a été choisie à la main.
 */
export function chaseDueAt(task: WaitingTask): Date {
  const reference = chaseReference(task);
  if (task.followUpAt && task.followUpAt > reference) return task.followUpAt;
  return new Date(reference.getTime() + CHASE_AFTER_DAYS * DAY_MS);
}

export function needsChase(task: WaitingTask, now: Date): boolean {
  return task.status === "WAITING_CLIENT" && chaseDueAt(task).getTime() <= now.getTime();
}

export type ChaseState =
  | { kind: "none" }
  | { kind: "due"; count: number; oldestDays: number }
  | { kind: "chased"; chasedAt: Date; nextAt: Date };

/** État de relance d'un projet à partir de ses tâches chez le client. */
export function chaseState(
  tasks: WaitingTask[],
  projectLastChasedAt: Date | null,
  now: Date,
): ChaseState {
  const waiting = tasks.filter((task) => task.status === "WAITING_CLIENT");
  if (waiting.length === 0) return { kind: "none" };

  const due = waiting.filter((task) => needsChase(task, now));
  if (due.length > 0) {
    const oldest = Math.min(...due.map((task) => waitingStart(task).getTime()));
    return { kind: "due", count: due.length, oldestDays: Math.max(0, Math.floor((now.getTime() - oldest) / DAY_MS)) };
  }

  const chasedDates = [projectLastChasedAt, ...waiting.map((task) => task.lastChasedAt)].filter((d): d is Date => d !== null);
  if (chasedDates.length === 0) return { kind: "none" };
  const chasedAt = new Date(Math.max(...chasedDates.map((d) => d.getTime())));
  const nextAt = new Date(Math.min(...waiting.map((task) => chaseDueAt(task).getTime())));
  return { kind: "chased", chasedAt, nextAt };
}

/** « Relancé il y a 1 j · prochaine relance jeu. » */
export function chaseLabel(state: ChaseState, now: Date): string | null {
  switch (state.kind) {
    case "none":
      return null;
    case "due":
      return "À relancer";
    case "chased": {
      const days = Math.max(0, Math.floor((now.getTime() - state.chasedAt.getTime()) / DAY_MS));
      const ago = days === 0 ? "aujourd’hui" : `il y a ${days}${NNBSP}j`;
      return `Relancé ${ago} · prochaine relance ${formatParis(state.nextAt, "EEE")}`;
    }
  }
}

export type ChaseItem = {
  title: string;
  zone: string | null;
  since: Date;
  waitingFor?: string | null;
};

/** Relance prête à envoyer : une ligne par élément en attente, ton poli, signature. */
export function buildChaseMessage(input: {
  contactFirstName?: string | null;
  projectName: string;
  items: ChaseItem[];
  senderFirstName: string;
}): { subject: string; body: string } {
  const greeting = input.contactFirstName ? `Bonjour ${input.contactFirstName},` : "Bonjour,";
  const lines = input.items.map((item) => {
    const page = item.zone ? ` (${item.zone})` : "";
    const waiting = item.waitingFor ? `${item.waitingFor}, ` : "";
    return `- ${item.title}${page}${NNBSP}: ${waiting}en attente depuis le ${formatParis(item.since, "dd/MM")}`;
  });
  const intro =
    input.items.length > 1
      ? `Pour avancer sur ${input.projectName}, nous attendons encore votre retour sur les points suivants${NNBSP}:`
      : `Pour avancer sur ${input.projectName}, nous attendons encore votre retour sur le point suivant${NNBSP}:`;

  const body = [
    greeting,
    "",
    intro,
    "",
    ...lines,
    "",
    "Pourriez-vous nous les transmettre dès que possible ? Nous reprenons la suite aussitôt.",
    "",
    "Merci d’avance,",
    `${input.senderFirstName} · Suzali Conseil`,
  ].join("\n");

  return { subject: `${input.projectName}${NNBSP}: éléments en attente`, body };
}

/** Lien `mailto:` ; null si le message est trop long pour tenir dans une URL fiable. */
export function mailtoLink(to: string | null | undefined, subject: string, body: string): string | null {
  const link = `mailto:${to ? encodeURIComponent(to).replace(/%40/g, "@") : ""}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return link.length > 1900 ? null : link;
}
