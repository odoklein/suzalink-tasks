import type { TaskStatus } from "@prisma/client";

import { STATUS_BY_VALUE } from "@/lib/constants";
import { formatParis } from "@/lib/time";

/**
 * Faits déterministes d'un récap client : la seule source de vérité, que le
 * texte soit généré par gabarit ou réécrit par l'IA (P7-03).
 */
export type RecapTask = { ref: string; title: string; zone: string | null; status: TaskStatus; statusChangedAt: Date };

export type RecapFacts = {
  project: { id: string; name: string; key: string; siteUrl: string | null };
  since: Date | null;
  lastDelivery: { title: string; deployedAt: Date; url: string | null } | null;
  done: RecapTask[];
  waiting: RecapTask[];
  remaining: RecapTask[];
};

function byZone(tasks: RecapTask[]) {
  const groups = new Map<string, RecapTask[]>();
  for (const task of tasks) {
    const zone = task.zone || "Général";
    groups.set(zone, [...(groups.get(zone) ?? []), task]);
  }
  return [...groups.entries()].map(([zone, items]) => `${zone}\n${items.map((t) => `  - ${t.title}`).join("\n")}`).join("\n\n");
}

/** Texte du récap généré par gabarit (comportement historique). */
export function renderRecapText(facts: RecapFacts): string {
  const { project, lastDelivery } = facts;
  const lines = [
    `Bonjour,`,
    ``,
    lastDelivery
      ? `Voici le point sur ${project.name}. Dernière mise en ligne le ${formatParis(lastDelivery.deployedAt, "d MMMM 'à' HH'h'mm")}${project.siteUrl ? ` : ${project.siteUrl}` : ""}.`
      : `Voici le point sur ${project.name}.`,
    `Pensez à faire un rafraîchissement forcé (Ctrl+F5) pour voir la dernière version.`,
  ];
  if (facts.done.length) lines.push(``, `CE QUI EST FAIT`, ``, byZone(facts.done));
  if (facts.waiting.length) lines.push(``, `EN ATTENTE DE VOTRE CÔTÉ`, ``, byZone(facts.waiting));
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

export function recapCounts(facts: RecapFacts) {
  return { done: facts.done.length, waiting: facts.waiting.length, remaining: facts.remaining.length };
}
