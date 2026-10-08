/**
 * P4-01 : rattrape le `type` (et `toStatus` pour les changements de statut) des
 * lignes d'activité écrites avant l'activité structurée.
 *
 * Idempotent : ne touche que les lignes `type = NOTE` dont le message est reconnu.
 * Par défaut : simulation (aucune écriture). `--apply` pour écrire.
 *
 *   npx tsx prisma/scripts/backfill-activity-types.ts
 *   npx tsx prisma/scripts/backfill-activity-types.ts --apply
 */
import { PrismaClient } from "@prisma/client";

import { classifyLegacyActivity } from "../../src/lib/activity-legacy";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const rows = await db.activity.findMany({
    where: { type: "NOTE" },
    select: { id: true, message: true },
  });

  const counts = new Map<string, number>();
  let unknown = 0;
  let updated = 0;

  for (const row of rows) {
    const result = classifyLegacyActivity(row.message);
    if (!result) {
      unknown++;
      continue;
    }
    counts.set(result.type, (counts.get(result.type) ?? 0) + 1);
    if (apply) {
      await db.activity.update({
        where: { id: row.id },
        data: { type: result.type, toStatus: result.toStatus ?? null },
      });
      updated++;
    }
  }

  console.log(`${rows.length} lignes de type NOTE examinées.`);
  for (const [type, count] of [...counts].sort()) console.log(`  ${type.padEnd(18)} ${count}`);
  console.log(`  ${"(non reconnues)".padEnd(18)} ${unknown}`);
  console.log(apply ? `${updated} lignes mises à jour.` : "Simulation : relancez avec --apply pour écrire.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
