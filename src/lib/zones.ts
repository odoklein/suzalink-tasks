import "server-only";

import type { Prisma } from "@prisma/client";

/**
 * Référentiel des pages d'un projet (P4-09). Pendant la transition, Task.zone
 * reste le libellé affiché ; Task.zoneId pointe vers la ligne Zone du même nom.
 */
export async function ensureZones(
  tx: Prisma.TransactionClient,
  projectId: string,
  names: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(names.map((name) => name?.trim()).filter((name): name is string => !!name))];
  if (unique.length === 0) return new Map();
  await tx.zone.createMany({
    data: unique.map((name) => ({ projectId, name })),
    skipDuplicates: true,
  });
  const zones = await tx.zone.findMany({ where: { projectId, name: { in: unique } }, select: { id: true, name: true } });
  return new Map(zones.map((zone) => [zone.name, zone.id]));
}

export async function ensureZone(tx: Prisma.TransactionClient, projectId: string, name: string | null | undefined) {
  const map = await ensureZones(tx, projectId, [name]);
  return name ? (map.get(name.trim()) ?? null) : null;
}
