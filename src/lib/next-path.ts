/**
 * Chemin de retour après connexion (`/login?next=…`). N'accepte qu'un chemin interne : commence par
 * « / », pas « // » (URL d'un autre site), pas de « \ » (que certains navigateurs lisent comme « / »),
 * pas de caractère de contrôle. Sinon : l'accueil.
 */
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) return "/";
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/";
  if (/[\u0000-\u001f\u007f]/.test(value)) return "/";
  if (value === "/login" || value.startsWith("/login?") || value.startsWith("/login/")) return "/";
  return value;
}
