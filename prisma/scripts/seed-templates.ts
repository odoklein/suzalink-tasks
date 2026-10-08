/**
 * P4-09 : crée les 3 modèles de projet fournis (Site vitrine, E-commerce,
 * Réseaux sociaux) s'ils n'existent pas encore (par nom). N'écrase jamais un
 * modèle déjà présent, même modifié.
 *
 * Par défaut : simulation. `--apply` pour écrire.
 *
 *   npx tsx prisma/scripts/seed-templates.ts
 *   npx tsx prisma/scripts/seed-templates.ts --apply
 */
import { PrismaClient } from "@prisma/client";

import { DEFAULT_TEMPLATES } from "../../src/lib/templates";

export async function seedTemplates(client: PrismaClient, write: boolean) {
  let created = 0;
  for (const template of DEFAULT_TEMPLATES) {
    const exists = await client.projectTemplate.findUnique({ where: { name: template.name }, select: { id: true } });
    if (exists) {
      console.log(`= ${template.name} (déjà présent)`);
      continue;
    }
    console.log(`+ ${template.name} : ${template.tasks.length} tâches`);
    created++;
    if (!write) continue;
    await client.projectTemplate.create({
      data: {
        name: template.name,
        type: template.type,
        milestones: template.milestones,
        zones: template.zones,
        tasks: { create: template.tasks.map((task, index) => ({ ...task, position: (index + 1) * 1000 })) },
      },
    });
  }
  return created;
}

// Lancé directement (et non importé par prisma/seed.ts).
if (process.argv[1]?.replace(/\\/g, "/").endsWith("seed-templates.ts")) {
  const apply = process.argv.includes("--apply");
  const db = new PrismaClient();
  seedTemplates(db, apply)
    .then((count) => console.log(`${count} modèles ${apply ? "créés" : "à créer"}.${apply ? "" : " Simulation : relancez avec --apply."}`))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => db.$disconnect());
}
