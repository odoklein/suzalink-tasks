/**
 * Couleurs « douces » dérivées de la couleur d’un membre ou d’un projet : le fond est la
 * couleur diluée dans la surface, le texte est la couleur renforcée avec l’encre. Ainsi la
 * couleur d’une personne ne se lit jamais comme un statut, en clair comme en sombre.
 */
const FALLBACK = "var(--muted)";

export function softColor(color?: string | null): string {
  return `color-mix(in oklch, ${color || FALLBACK} 18%, var(--surface))`;
}

export function strongColor(color?: string | null): string {
  return `color-mix(in oklch, ${color || FALLBACK} 70%, var(--ink))`;
}
