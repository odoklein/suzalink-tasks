/**
 * Projet suggéré pour une réunion, d'après ses invités et son titre. Module pur.
 * Une suggestion seulement : le manager la confirme dans Réunions.
 */

export type MatchContact = { email: string | null; clientId: string };
export type MatchProject = { id: string; key: string; name: string; clientId: string | null };
export type ProjectSuggestion = { projectId: string; by: "contact" | "titre" };

/** Messageries grand public : un domaine partagé ne désigne pas un client. */
const PUBLIC_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "outlook.com",
  "outlook.fr",
  "hotmail.com",
  "hotmail.fr",
  "live.com",
  "live.fr",
  "yahoo.com",
  "yahoo.fr",
  "icloud.com",
  "me.com",
  "orange.fr",
  "wanadoo.fr",
  "free.fr",
  "laposte.net",
  "sfr.fr",
  "gmx.fr",
  "proton.me",
  "protonmail.com",
]);

const domainOf = (email: string) => email.slice(email.lastIndexOf("@") + 1).toLowerCase();

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

/** Projets dont la clé (« BG ») ou le nom figure dans le titre. */
function byTitle(title: string, projects: MatchProject[]): MatchProject[] {
  const words = new Set(title.split(/[^A-Za-z0-9]+/).filter(Boolean));
  const text = ` ${normalize(title)} `;
  return projects.filter((project) => {
    if (words.has(project.key.toUpperCase())) return true;
    const name = normalize(project.name);
    return name.length >= 3 && text.includes(` ${name} `);
  });
}

export function suggestProject(
  meeting: { title: string; attendeeEmails: string[] },
  contacts: MatchContact[],
  projects: MatchProject[],
  agencyDomain: string,
): ProjectSuggestion | null {
  const emails = meeting.attendeeEmails.map((email) => email.toLowerCase());
  const external = emails.filter((email) => domainOf(email) !== agencyDomain.toLowerCase());

  // 1. Invités connus comme contacts, ou du même domaine d'entreprise qu'un contact.
  const known = new Map(contacts.filter((contact) => contact.email).map((contact) => [contact.email!.toLowerCase(), contact.clientId]));
  const domains = new Map<string, Set<string>>();
  for (const [email, clientId] of known) {
    const domain = domainOf(email);
    if (PUBLIC_DOMAINS.has(domain)) continue;
    domains.set(domain, (domains.get(domain) ?? new Set()).add(clientId));
  }
  const clientIds = new Set<string>();
  for (const email of external) {
    const direct = known.get(email);
    if (direct) clientIds.add(direct);
    else for (const clientId of domains.get(domainOf(email)) ?? []) clientIds.add(clientId);
  }

  if (clientIds.size > 0) {
    const candidates = projects.filter((project) => project.clientId && clientIds.has(project.clientId));
    if (candidates.length === 1) return { projectId: candidates[0].id, by: "contact" };
    // Plusieurs projets chez ce client : le titre départage.
    const titled = byTitle(meeting.title, candidates);
    if (titled.length === 1) return { projectId: titled[0].id, by: "titre" };
    return null;
  }

  // 2. Personne de connu : la clé ou le nom du projet dans le titre.
  const titled = byTitle(meeting.title, projects);
  return titled.length === 1 ? { projectId: titled[0].id, by: "titre" } : null;
}
