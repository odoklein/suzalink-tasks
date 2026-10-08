/** Dernier projet utilisé (slug), mémorisé sur cet appareil pour présélectionner la cible d’une nouvelle tâche. */
const KEY = "last-project";

export function readLastProject(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function rememberLastProject(slug: string) {
  try {
    localStorage.setItem(KEY, slug);
  } catch {
    // stockage indisponible (navigation privée) : sans conséquence
  }
}

type Orderable = { slug: string; status: string };

/**
 * Projets proposés pour créer une tâche : le projet affiché, puis le dernier utilisé, puis les
 * projets actifs (ni terminés ni en pause), dans l’ordre reçu. Sans doublon.
 */
export function creationTargets<T extends Orderable>(projects: T[], currentSlug: string | null, lastSlug: string | null): T[] {
  const bySlug = (slug: string | null) => (slug ? projects.find((project) => project.slug === slug) : undefined);
  const first = [bySlug(currentSlug), bySlug(lastSlug)].filter((project): project is T => Boolean(project));
  const active = projects.filter((project) => project.status === "ACTIVE" || project.status === "WAITING_CLIENT");
  return [...new Set([...first, ...active])];
}
