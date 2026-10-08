/** Thème d’affichage, mémorisé dans un cookie pour que le serveur rende le bon <html data-theme>. */
export const THEME_COOKIE = "theme";
export const THEMES = ["system", "light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

export const THEME_LABELS: Record<Theme, string> = {
  system: "Système",
  light: "Clair",
  dark: "Sombre",
};

export function parseTheme(value: string | undefined | null): Theme {
  return THEMES.includes(value as Theme) ? (value as Theme) : "system";
}

/** Valeur de l’attribut data-theme : absent pour « Système » (la préférence du navigateur décide). */
export function themeAttribute(theme: Theme): "light" | "dark" | undefined {
  return theme === "system" ? undefined : theme;
}
