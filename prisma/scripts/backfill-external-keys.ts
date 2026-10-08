/**
 * P4-03 : renseigne Task.externalKey (clé de déduplication des imports) pour les
 * tâches déjà importées, c'est-à-dire celles dont la source commence par « Retours ».
 * La clé est sha1(page|retour) normalisés, comme à l'import (src/lib/import-key.ts).
 *
 * Idempotent : ne touche que les tâches sans clé. Si deux tâches d'un même projet
 * donnent la même clé (une même ligne importée deux fois), seule la plus ancienne
 * reçoit la clé ; les autres sont signalées et restent sans clé.
 *
 * Par défaut : simulation. `--apply` pour écrire.
 *
 *   npx tsx prisma/scripts/backfill-external-keys.ts
 *   npx tsx prisma/scripts/backfill-external-keys.ts --apply
 */
import { PrismaClient } from "@prisma/client";

import { importKey } from "../../src/lib/import-key";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const tasks = await db.task.findMany({
    where: { externalKey: null, source: { startsWith: "Retours" } },
    select: { id: true, number: true, title: true, zone: true, projectId: true, project: { select: { key: true } } },
    orderBy: [{ projectId: "asc" }, { number: "asc" }],
  });
  const taken = await db.task.findMany({
    where: { externalKey: { not: null } },
    select: { projectId: true, externalKey: true },
  });

  const used = new Set(taken.map((t) => `${t.projectId}:${t.externalKey}`));
  let keyed = 0;
  let duplicates = 0;

  for (const task of tasks) {
    const key = importKey(task.zone, task.title);
    const slot = `${task.projectId}:${key}`;
    const ref = `${task.project.key}-${task.number}`;
    if (used.has(slot)) {
      duplicates++;
      console.log(`${ref}  doublon d'une tâche déjà clée : laissée sans clé`);
      continue;
    }
    used.add(slot);
    keyed++;
    console.log(`${ref}  externalKey <- ${key}`);
    if (apply) await db.task.update({ where: { id: task.id }, data: { externalKey: key } });
  }

  console.log(
    `${keyed} tâches à clé${apply ? " écrites" : ""}, ${duplicates} doublons laissés sans clé.` +
      (apply ? "" : " Simulation : relancez avec --apply pour écrire."),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
