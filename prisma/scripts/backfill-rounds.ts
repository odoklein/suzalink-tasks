/**
 * P4-06 : crée les lots de retours (FeedbackRound) des tâches existantes en les
 * regroupant par (projet, source). Le lot est reçu à la date de la plus ancienne
 * tâche, clôturé si tout est fait. Pas de collage d'origine (rawText) : il n'a
 * jamais été conservé.
 *
 * Idempotent : ne traite que les tâches avec une source et sans lot.
 * Par défaut : simulation. `--apply` pour écrire.
 *
 *   npx tsx prisma/scripts/backfill-rounds.ts
 *   npx tsx prisma/scripts/backfill-rounds.ts --apply
 */
import { PrismaClient } from "@prisma/client";

import { groupLegacyRounds } from "../../src/lib/rounds";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const tasks = await db.task.findMany({
    where: { roundId: null, source: { not: null } },
    select: { id: true, projectId: true, source: true, createdAt: true, status: true },
  });
  const rounds = groupLegacyRounds(tasks);

  for (const round of rounds) {
    console.log(`${round.projectId}  « ${round.label} »  ${round.taskIds.length} tâches  ${round.status}`);
    if (!apply) continue;
    await db.$transaction(async (tx) => {
      const created = await tx.feedbackRound.create({
        data: {
          projectId: round.projectId,
          label: round.label,
          receivedAt: round.receivedAt,
          status: round.status,
          channel: round.channel,
        },
        select: { id: true },
      });
      await tx.task.updateMany({ where: { id: { in: round.taskIds }, roundId: null }, data: { roundId: created.id } });
    });
  }
  console.log(
    `${rounds.length} lots ${apply ? "créés" : "à créer"}.` + (apply ? "" : " Simulation : relancez avec --apply pour écrire."),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
