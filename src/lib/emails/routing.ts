import { domainOf } from "@/lib/meetings/agency";
import { projectsNamedIn, PUBLIC_DOMAINS, type MatchContact, type MatchProject } from "@/lib/meetings/matching";

/**
 * À quel client, puis à quel projet, rattacher un e-mail. Module pur.
 * Ordre : contact connu ou domaine d'un client → fil de discussion déjà
 * rattaché → clé ou nom du projet dans l'objet. Sinon, rien (inconnu).
 */

export type EmailRoute = { clientId: string; projectId: string | null; by: "contact" | "domaine" | "fil" | "titre" };

export function routeEmail(
  input: {
    /** Adresses extérieures à l'agence (expéditeur et destinataires). */
    participants: string[];
    subject: string;
    /** Rattachement d'un e-mail précédent du même fil. */
    thread: { clientId: string; projectId: string | null } | null;
  },
  contacts: MatchContact[],
  projects: MatchProject[],
): EmailRoute | null {
  const participants = input.participants.map((email) => email.toLowerCase());
  const known = new Map(contacts.filter((contact) => contact.email).map((contact) => [contact.email!.toLowerCase(), contact.clientId]));

  let clientIds = new Set(participants.flatMap((email) => (known.has(email) ? [known.get(email)!] : [])));
  let by: EmailRoute["by"] = "contact";
  if (clientIds.size === 0) {
    const byDomain = new Map<string, Set<string>>();
    for (const [email, clientId] of known) {
      const domain = domainOf(email);
      if (!PUBLIC_DOMAINS.has(domain)) byDomain.set(domain, (byDomain.get(domain) ?? new Set()).add(clientId));
    }
    clientIds = new Set(participants.flatMap((email) => [...(byDomain.get(domainOf(email)) ?? [])]));
    by = "domaine";
  }

  if (clientIds.size > 0) {
    const candidates = projects.filter((project) => project.clientId && clientIds.has(project.clientId));
    const named = projectsNamedIn(input.subject, candidates);
    if (named.length === 1) return { clientId: named[0].clientId!, projectId: named[0].id, by };
    if (input.thread && clientIds.has(input.thread.clientId)) return { ...input.thread, by: "fil" };
    if (clientIds.size === 1) {
      const clientId = [...clientIds][0];
      const own = candidates.filter((project) => project.clientId === clientId);
      return { clientId, projectId: own.length === 1 ? own[0].id : null, by };
    }
    return null;
  }

  if (input.thread) return { ...input.thread, by: "fil" };
  const named = projectsNamedIn(input.subject, projects).filter((project) => project.clientId);
  return named.length === 1 ? { clientId: named[0].clientId!, projectId: named[0].id, by: "titre" } : null;
}

/** Interlocuteur inconnu à proposer comme contact : l'agence lui a écrit, et il a répondu. */
export const isSenderWorthSuggesting = (sender: { received: number; sent: number; dismissedAt: Date | null }) =>
  !sender.dismissedAt && sender.received >= 1 && sender.sent >= 1;

/** Nom de client proposé pour un interlocuteur inconnu : son entreprise d'après le domaine, sinon son nom. */
export function suggestedClientName(sender: { email: string; name: string | null }): string {
  const domain = domainOf(sender.email);
  if (PUBLIC_DOMAINS.has(domain)) return sender.name ?? sender.email;
  const base = domain.split(".").slice(-2, -1)[0] ?? domain;
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toLocaleUpperCase("fr-FR") + word.slice(1))
    .join(" ");
}
