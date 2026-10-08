/**
 * P4-09 : crée les lignes Zone à partir des libellés Task.zone existants et
 * renseigne Task.zoneId. Task.zone reste le libellé affiché.
 *
 * Idempotent : ne touche que les tâches avec une zone et sans zoneId.
 * Par défaut : simulation. `--apply` pour écrire.
 *
 *   npx tsx prisma/scripts/backfill-zones.ts
 *   npx tsx prisma/scripts/backfill-zones.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const groups = await db.task.groupBy({
    by: ["projectId", "zone"],
    where: { zone: { not: null }, zoneId: null },
    _count: { _all: true },
  });

  let tasks = 0;
  for (const group of groups) {
    const name = group.zone!.trim();
    if (!name) continue;
    tasks += group._count._all;
    console.log(`${group.projectId}  « ${name} »  ${group._count._all} tâches`);
    if (!apply) continue;
    const zone = await db.zone.upsert({
      where: { projectId_name: { projectId: group.projectId, name } },
      create: { projectId: group.projectId, name },
      update: {},
      select: { id: true },
    });
    await db.task.updateMany({
      where: { projectId: group.projectId, zone: group.zone, zoneId: null },
      data: { zoneId: zone.id },
    });
  }
  console.log(
    `${groups.length} pages, ${tasks} tâches ${apply ? "rattachées" : "à rattacher"}.` +
      (apply ? "" : " Simulation : relancez avec --apply pour écrire."),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
