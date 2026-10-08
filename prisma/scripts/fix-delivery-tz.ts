/**
 * Rattrapage P1-05 : heures de mise en ligne enregistrées avec 1 à 2 h de retard.
 *
 * Avant le correctif, `createDelivery` lisait la valeur d'un champ « datetime-local »
 * (heure de Paris, sans fuseau) avec `new Date(...)` sur un serveur en UTC. Un 14h30 saisi
 * était donc stocké comme 14:30 UTC, soit 16h30 à Paris. Ce script relit les champs UTC
 * de la date stockée comme une heure de Paris et propose la correction.
 *
 * Sélection : mises en ligne avec un auteur (donc saisies dans l'application) et
 * non rétro-saisies. Les lignes du seed ont des décalages explicites (+02:00) et
 * `createdAt` postérieur au jour de `deployedAt` : elles sont écartées. Relisez la liste
 * avant d'appliquer ; `--only=id1,id2` restreint l'application à certaines lignes.
 *
 *   npx tsx prisma/scripts/fix-delivery-tz.ts                         (simulation, n'écrit rien)
 *   npx tsx prisma/scripts/fix-delivery-tz.ts --before=2026-10-09T08:00:00Z --apply
 *
 * `--before` : instant de mise en production du correctif ; les mises en ligne créées après
 * sont déjà justes. Il est obligatoire avec `--apply`.
 * À APPLIQUER UNE SEULE FOIS : rien ne marque les lignes corrigées, un second passage
 * décalerait de nouveau les heures.
 */
import { PrismaClient } from "@prisma/client";

import { utcWallClockAsParis } from "../../src/lib/delivery-tz";
import { endOfDayParis, formatParis } from "../../src/lib/time";

const db = new PrismaClient();

function arg(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((a) => a.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const beforeRaw = arg("before");
  const only = arg("only")?.split(",").filter(Boolean);

  if (apply && !beforeRaw) throw new Error("--before=<ISO> est obligatoire avec --apply.");
  const before = beforeRaw ? new Date(beforeRaw) : new Date();
  if (Number.isNaN(before.getTime())) throw new Error(`--before invalide : ${beforeRaw}`);

  const deliveries = await db.delivery.findMany({
    where: { authorId: { not: null }, createdAt: { lt: before } },
    orderBy: { deployedAt: "asc" },
    include: { project: { select: { name: true } } },
  });

  // Écarte les lignes rétro-saisies (créées après le jour de la mise en ligne).
  const candidates = deliveries.filter((d) => d.createdAt <= endOfDayParis(d.deployedAt));
  const skipped = deliveries.length - candidates.length;

  console.log(`${candidates.length} mise(s) en ligne à corriger (${skipped} rétro-saisie(s) ignorée(s)).\n`);
  const fmt = (d: Date) => formatParis(d, "yyyy-MM-dd HH:mm");
  for (const d of candidates) {
    const fixed = utcWallClockAsParis(d.deployedAt);
    // Une mise en ligne ne peut pas être postérieure à sa propre saisie : signe d'un décalage.
    const future = d.deployedAt > d.createdAt ? "  [dans le futur de sa saisie]" : "";
    console.log(`${d.id}  ${d.project.name} : ${d.title}`);
    console.log(`    affiché ${fmt(d.deployedAt)} (Paris) -> ${fmt(fixed)} (Paris)${future}`);
  }

  if (!apply) {
    console.log("\nSimulation : rien n'a été écrit. Ajoutez --before=<ISO> --apply pour appliquer.");
    return;
  }

  const targets = only ? candidates.filter((d) => only.includes(d.id)) : candidates;
  for (const d of targets) {
    await db.delivery.update({ where: { id: d.id }, data: { deployedAt: utcWallClockAsParis(d.deployedAt) } });
  }
  console.log(`\n${targets.length} mise(s) en ligne corrigée(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
