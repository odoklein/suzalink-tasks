/**
 * Chemins accessibles sans cookie de session.
 *
 * Chacune de ces routes s'authentifie elle-même (signature de webhook, jeton
 * cron, clé d'API, lien magique, jeton d'agenda…). Ce fichier est importé par
 * le proxy : il ne doit contenir **aucun secret** (le scan de secrets de
 * Netlify bloque le déploiement si une valeur sensible finit dans le bundle).
 */
export const PUBLIC_PATHS = [
  "/login",
  "/api/hooks/",
  "/api/cron/",
  "/api/v1/",
  "/api/mcp",
  "/api/auth/",
  "/api/ics/",
  "/api/widget/",
  "/p/",
  "/widget.js",
  "/sw.js",
  "/manifest.webmanifest",
  "/icon",
  "/apple-icon",
] as const;

/**
 * Vrai si `pathname` est public. Une entrée terminée par « / » couvre tout le
 * sous-arbre ; les autres couvrent le chemin exact et ses variantes générées
 * (`/icon.svg`, `/icon-192.png`, `/api/mcp/…`).
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((entry) => {
    if (entry.endsWith("/")) return pathname.startsWith(entry);
    if (pathname === entry) return true;
    if (!pathname.startsWith(entry)) return false;
    const next = pathname[entry.length];
    // `/loginx` ou `/api/mcpx` ne sont pas publics ; `/icon0`, `/icon.svg`,
    // `/icon-192.png` (fichiers d'icônes générés par Next) le sont.
    if (entry === "/icon" || entry === "/apple-icon") return /[./\-0-9]/.test(next);
    return next === "/" || next === "?";
  });
}
