import type { Channel } from "@prisma/client";

const VIA_BY_PREFIX: [string, Channel][] = [
  ["/api/v1/", "API"],
  ["/api/mcp", "MCP"],
  ["/api/hooks/", "DEPLOY"],
  ["/api/cron/", "SYSTEM"],
  ["/api/widget/", "WIDGET"],
  ["/p/", "PORTAL"],
];

const KEY_PATTERNS = [
  /^\/api\/v1\/projects\/([A-Za-z][A-Za-z0-9]{0,5})(?:\/|$)/, // /api/v1/projects/BG/tasks
  /^\/api\/v1\/tasks\/([A-Za-z][A-Za-z0-9]{0,5})-\d+/, // /api/v1/tasks/BG-12
  /^\/t\/([A-Za-z][A-Za-z0-9]{0,5})-\d+/, // /t/BG-12
  /[?&]tache=([A-Za-z][A-Za-z0-9]{0,5})-\d+/, // ?tache=BG-12
];

/**
 * Étiquettes d'une erreur serveur pour Sentry : le canal (`via`) déduit de
 * la route, et la clé de projet quand l'URL en contient une.
 */
export function errorTags(path: string): { via: Channel; projectKey?: string } {
  const pathname = path.split("?")[0];
  const via = VIA_BY_PREFIX.find(([prefix]) => pathname.startsWith(prefix))?.[1] ?? "WEB";
  for (const pattern of KEY_PATTERNS) {
    const match = pattern.exec(pattern.source.includes("tache") ? path : pathname);
    if (match) return { via, projectKey: match[1].toUpperCase() };
  }
  return { via };
}
