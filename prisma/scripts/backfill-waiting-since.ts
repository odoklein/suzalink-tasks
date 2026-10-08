/**
 * P4-02 : renseigne Task.waitingSince pour les tâches actuellement « Chez le
 * client » (valeur = statusChangedAt, la meilleure information disponible).
 *
 * Idempotent : ne touche que les tâches WAITING_CLIENT dont waitingSince est vide.
 * Par défaut : simulation. `--apply` pour écrire.
 *
 *   npx tsx prisma/scripts/backfill-waiting-since.ts
 *   npx tsx prisma/scripts/backfill-waiting-since.ts --apply
 */
import { PrismaClient } from "@prisma/client";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const tasks = await db.task.findMany({
    where: { status: "WAITING_CLIENT", waitingSince: null },
    select: { id: true, number: true, statusChangedAt: true, project: { select: { key: true } } },
  });

  for (const task of tasks) {
    console.log(`${task.project.key}-${task.number}  waitingSince <- ${task.statusChangedAt.toISOString()}`);
    if (apply) {
      await db.task.update({ where: { id: task.id }, data: { waitingSince: task.statusChangedAt } });
    }
  }
  console.log(
    apply
      ? `${tasks.length} tâches mises à jour.`
      : `${tasks.length} tâches à mettre à jour. Simulation : relancez avec --apply pour écrire.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
