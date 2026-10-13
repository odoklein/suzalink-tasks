/** Projets récemment ouverts (slugs, du plus récent au plus ancien), propres à ce navigateur. */
const KEY = "suzali:recent-projects";
const MAX = 12;
const EVENT = "suzali:recent-projects";

/** Valeur brute, comparable d’un rendu à l’autre (useSyncExternalStore). */
export function readRecentProjectsRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function parseRecentProjects(raw: string): string[] {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value.filter((slug): slug is string => typeof slug === "string").slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export function rememberProject(slug: string) {
  try {
    const current = parseRecentProjects(readRecentProjectsRaw());
    if (current[0] === slug) return;
    localStorage.setItem(KEY, JSON.stringify([slug, ...current.filter((entry) => entry !== slug)].slice(0, MAX)));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // navigation privée : on s’en passe
  }
}

export function subscribeRecentProjects(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

type Listable = { slug: string; status: string; _count: { tasks: number } };

/**
 * Projets montrés dans la barre latérale : le projet ouvert, puis les derniers consultés, puis
 * les projets en cours qui ont le plus de tâches ouvertes. `max` au plus, sans doublon ; le
 * reste se retrouve dans la page Projets.
 */
export function sidebarProjects<T extends Listable>(projects: T[], recent: string[], currentSlug: string | null, max: number): T[] {
  const bySlug = new Map(projects.map((project) => [project.slug, project]));
  const pinned = [currentSlug, ...recent].flatMap((slug) => (slug && bySlug.has(slug) ? [bySlug.get(slug)!] : []));
  const busiest = projects
    .filter((project) => project.status !== "DONE")
    .sort((a, b) => b._count.tasks - a._count.tasks);
  return [...new Set([...pinned, ...busiest])].slice(0, max);
}
