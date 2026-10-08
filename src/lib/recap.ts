import type { ClientKind, TaskStatus } from "@prisma/client";

import { STATUS_BY_VALUE } from "@/lib/constants";
import { formatParis } from "@/lib/time";

/**
 * Récap client v2 (P4-08) : texte selon le type de client, sections
 * facultatives, conversion en HTML. Module pur (utilisé côté client pour
 * régénérer sans aller-retour serveur).
 */

const NNBSP = " ";

export type RecapTask = {
  ref: string;
  title: string;
  zone: string | null;
  status: TaskStatus;
  billable: boolean;
  completedAt: Date | string | null;
  /** Début de l'attente pour les tâches chez le client. */
  waitingSince: Date | string | null;
};

export type RecapFacts = {
  projectName: string;
  siteUrl: string | null;
  clientKind: ClientKind | null;
  contactFirstName: string | null;
  senderFirstName: string;
  lastDeliveryAt: Date | string | null;
  tasks: RecapTask[];
};

export type RecapOptions = {
  /** Tâches faites depuis cette date (incluse) ; null = toutes. */
  since: Date | null;
  /** Agence : retire toute mention de Suzali. */
  whiteLabel: boolean;
  /** Section « Modifications supplémentaires réalisées » (hors périmètre). */
  includeBillable: boolean;
  /** Section « En attente de votre côté », avec « depuis le … ». */
  includeWaiting: boolean;
};

export type RecapResult = {
  subject: string;
  text: string;
  counts: { done: number; billable: number; waiting: number; remaining: number };
};

const asDate = (value: Date | string | null) => (value ? new Date(value) : null);

function byZone(tasks: RecapTask[], line: (task: RecapTask) => string): string[] {
  const groups = new Map<string, RecapTask[]>();
  for (const task of tasks) {
    const zone = task.zone || "Général";
    groups.set(zone, [...(groups.get(zone) ?? []), task]);
  }
  const out: string[] = [];
  for (const [zone, items] of groups) {
    if (out.length) out.push("");
    out.push(zone, ...items.map((task) => `  - ${line(task)}`));
  }
  return out;
}

const AGENCY_STATUS: Partial<Record<TaskStatus, string>> = {
  TODO: "à faire",
  IN_PROGRESS: "en cours",
  REVIEW: "à valider",
};

export function buildRecapText(facts: RecapFacts, options: RecapOptions): RecapResult {
  const agency = facts.clientKind === "AGENCY";
  const since = options.since;
  const done = facts.tasks.filter((task) => {
    if (task.status !== "DONE") return false;
    const completed = asDate(task.completedAt);
    return !since || (!!completed && completed >= since);
  });
  const billable = options.includeBillable ? done.filter((task) => task.billable) : [];
  const doneMain = options.includeBillable ? done.filter((task) => !task.billable) : done;
  const waiting = options.includeWaiting ? facts.tasks.filter((task) => task.status === "WAITING_CLIENT") : [];
  const remaining = facts.tasks.filter((task) => ["TODO", "IN_PROGRESS", "REVIEW"].includes(task.status));

  // Agence : technique, avec les références. Client direct : langage simple, sans statut interne.
  const label = (task: RecapTask) => (agency ? `${task.ref} ${task.title}` : task.title);
  const remainingLine = (task: RecapTask) => {
    if (agency) return `${label(task)} (${AGENCY_STATUS[task.status] ?? ""})`;
    return task.status === "REVIEW" ? `${task.title} (en cours de finalisation)` : task.title;
  };

  const lastDelivery = asDate(facts.lastDeliveryAt);
  const lines = [facts.contactFirstName ? `Bonjour ${facts.contactFirstName},` : "Bonjour,", ""];
  lines.push(
    lastDelivery
      ? `Voici le point sur ${facts.projectName}. Dernière mise en ligne le ${formatParis(lastDelivery, "d MMMM 'à' HH'h'mm")}${facts.siteUrl ? `${NNBSP}: ${facts.siteUrl}` : ""}.`
      : `Voici le point sur ${facts.projectName}.`,
  );
  if (lastDelivery) lines.push("Pensez à faire un rafraîchissement forcé (Ctrl+F5) pour voir la dernière version.");

  if (doneMain.length) lines.push("", "CE QUI EST FAIT", "", ...byZone(doneMain, label));
  if (billable.length) lines.push("", "MODIFICATIONS SUPPLÉMENTAIRES RÉALISÉES", "", ...byZone(billable, label));
  if (waiting.length) {
    lines.push(
      "",
      "EN ATTENTE DE VOTRE CÔTÉ",
      "",
      ...byZone(waiting, (task) => {
        const start = asDate(task.waitingSince);
        return start ? `${label(task)} (depuis le ${formatParis(start, "dd/MM")})` : label(task);
      }),
    );
  }
  if (remaining.length) lines.push("", "EN COURS CHEZ NOUS", "", ...remaining.map((task) => `  - ${remainingLine(task)}`));

  // La marque blanche ne concerne que les agences : elles présentent le travail comme le leur.
  const signature = agency && options.whiteLabel ? facts.senderFirstName : `${facts.senderFirstName} · Suzali Conseil`;
  lines.push("", "Bonne journée,", signature);

  return {
    subject: `${facts.projectName}${NNBSP}: point d’avancement`,
    text: lines.join("\n"),
    counts: { done: doneMain.length, billable: billable.length, waiting: waiting.length, remaining: remaining.length },
  };
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Convertit le texte du récap (éventuellement retouché) en HTML simple pour
 * un e-mail : titres en capitales → <h3>, lignes « - » → listes, le reste en paragraphes.
 */
export function recapTextToHtml(text: string): string {
  const out: string[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) out.push(`<ul>${list.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    list = [];
  };
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trimEnd();
    const item = /^\s*[-•]\s+(.*)$/.exec(line);
    if (item) {
      list.push(escapeHtml(item[1]));
      continue;
    }
    flush();
    if (!line.trim()) continue;
    const isHeading = line === line.toUpperCase() && /[A-ZÀ-Ý]/.test(line) && line.length < 60;
    out.push(isHeading ? `<h3>${escapeHtml(line)}</h3>` : `<p>${escapeHtml(line)}</p>`);
  }
  flush();
  return out.join("\n");
}

/** Date « depuis » par défaut : le dernier récap envoyé, sinon la mise en ligne précédant la dernière. */
export function defaultRecapSince(lastRecapAt: Date | null, deliveryDates: Date[]): Date | null {
  if (lastRecapAt) return lastRecapAt;
  const sorted = [...deliveryDates].sort((a, b) => b.getTime() - a.getTime());
  return sorted[1] ?? null;
}

/**
 * Faits déterministes d'un récap client pour les services / API (P6 / P7-03).
 */
export type ServiceRecapTask = { ref: string; title: string; zone: string | null; status: TaskStatus; statusChangedAt: Date };

export type ServiceRecapFacts = {
  project: { id: string; name: string; key: string; siteUrl: string | null };
  since: Date | null;
  lastDelivery: { title: string; deployedAt: Date; url: string | null } | null;
  done: ServiceRecapTask[];
  waiting: ServiceRecapTask[];
  remaining: ServiceRecapTask[];
};

function byZoneService(tasks: ServiceRecapTask[]) {
  const groups = new Map<string, ServiceRecapTask[]>();
  for (const task of tasks) {
    const zone = task.zone || "Général";
    groups.set(zone, [...(groups.get(zone) ?? []), task]);
  }
  return [...groups.entries()].map(([zone, items]) => `${zone}\n${items.map((t) => `  - ${t.title}`).join("\n")}`).join("\n\n");
}

/** Texte du récap généré par gabarit (comportement historique / services). */
export function renderRecapText(facts: ServiceRecapFacts): string {
  const { project, lastDelivery } = facts;
  const lines = [
    `Bonjour,`,
    ``,
    lastDelivery
      ? `Voici le point sur ${project.name}. Dernière mise en ligne le ${formatParis(lastDelivery.deployedAt, "d MMMM 'à' HH'h'mm")}${project.siteUrl ? ` : ${project.siteUrl}` : ""}.`
      : `Voici le point sur ${project.name}.`,
    `Pensez à faire un rafraîchissement forcé (Ctrl+F5) pour voir la dernière version.`,
  ];
  if (facts.done.length) lines.push(``, `CE QUI EST FAIT`, ``, byZoneService(facts.done));
  if (facts.waiting.length) lines.push(``, `EN ATTENTE DE VOTRE CÔTÉ`, ``, byZoneService(facts.waiting));
  if (facts.remaining.length) {
    lines.push(
      ``,
      `EN COURS CHEZ NOUS`,
      ``,
      facts.remaining.map((t) => `  - ${t.title} (${STATUS_BY_VALUE[t.status].label.toLowerCase()})`).join("\n"),
    );
  }
  lines.push(``, `Belle journée,`);
  return lines.join("\n");
}

export function recapCounts(facts: ServiceRecapFacts) {
  return { done: facts.done.length, waiting: facts.waiting.length, remaining: facts.remaining.length };
}
