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

/** Palette des projets : texte blanc lisible en clair, texte sombre lisible en sombre. */
export const PROJECT_PALETTE = [
  { name: "Rouge", light: "#ba362e", dark: "#ef675a" },
  { name: "Orange", light: "#ad4a00", dark: "#e07937" },
  { name: "Ocre", light: "#906200", dark: "#bf8f34" },
  { name: "Vert", light: "#048149", dark: "#4ab074" },
  { name: "Sarcelle", light: "#007c87", dark: "#39aab6" },
  { name: "Cobalt", light: "#3065cc", dark: "#5c94ff" },
  { name: "Indigo", light: "#6559c3", dark: "#9087f6" },
  { name: "Prune", light: "#974992", dark: "#c876c1" },
  { name: "Ardoise", light: "#606d7d", dark: "#8c9aab" },
] as const;

/** Texte posé sur une pastille de projet. */
export const TILE_INK_LIGHT = "#ffffff";
export const TILE_INK_DARK = "#0b0d10";

/** Anciennes couleurs (hexadécimal, majuscules) → nouvelle couleur la plus proche. */
export const LEGACY_PROJECT_COLORS: Record<string, string> = {
  "#E5533D": "#ba362e",
  "#E8913A": "#ad4a00",
  "#C9A227": "#906200",
  "#2E9E6B": "#048149",
  "#1F8A9E": "#007c87",
  "#3B6CF6": "#3065cc",
  "#6A5AE0": "#6559c3",
  "#B04FA8": "#974992",
  "#55606E": "#606d7d",
};

/** Couleur de palette (claire) correspondant à une valeur stockée, même ancienne. */
export function normalizeProjectColor(color: string): string {
  const upper = color.toUpperCase();
  const legacy = LEGACY_PROJECT_COLORS[upper];
  if (legacy) return legacy;
  return PROJECT_PALETTE.find((entry) => entry.light.toUpperCase() === upper)?.light ?? color;
}

/** Variantes claire et sombre d’une couleur de projet ; une couleur inconnue reste telle quelle. */
export function projectColorPair(color: string): { light: string; dark: string } {
  const light = normalizeProjectColor(color);
  const entry = PROJECT_PALETTE.find((candidate) => candidate.light === light);
  return { light, dark: entry?.dark ?? light };
}

/** Rapport de contraste WCAG entre deux couleurs hexadécimales (#rrggbb). */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Variables CSS pour la classe .project-swatch : fond clair ou sombre selon le thème.
 * À étaler dans un attribut style.
 */
export function projectSwatchVars(color: string): Record<string, string> {
  const { light, dark } = projectColorPair(color);
  return { "--pc-light": light, "--pc-dark": dark };
}
