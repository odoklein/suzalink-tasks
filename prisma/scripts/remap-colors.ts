/**
 * P2-06 : fait passer les projets de l’ancienne palette à la nouvelle (texte blanc ≥ 4,5:1).
 * Chaque ancienne couleur est remplacée par la plus proche (voir LEGACY_PROJECT_COLORS dans
 * src/lib/color.ts). Une couleur inconnue (saisie à la main) n’est pas touchée.
 *
 * Idempotent. SIMULATION par défaut : rien n’est écrit sans --apply.
 *
 *   npx tsx prisma/scripts/remap-colors.ts            (simulation)
 *   npx tsx prisma/scripts/remap-colors.ts --apply
 *
 * Les couleurs des membres ne changent pas : les avatars « doux » les diluent déjà.
 */
import { PrismaClient } from "@prisma/client";

import { LEGACY_PROJECT_COLORS } from "../../src/lib/color";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const projects = await db.project.findMany({ select: { id: true, name: true, color: true } });
  let changes = 0;

  for (const project of projects) {
    const next = LEGACY_PROJECT_COLORS[project.color.toUpperCase()];
    if (!next) continue;
    changes++;
    console.log(`${project.name} : ${project.color} -> ${next}`);
    if (apply) await db.project.update({ where: { id: project.id }, data: { color: next } });
  }

  console.log(
    changes === 0
      ? "Rien à faire."
      : `${changes} projet(s) ${apply ? "mis à jour" : "à mettre à jour (relancer avec --apply)"}.`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
