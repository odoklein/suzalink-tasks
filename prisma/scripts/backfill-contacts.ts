/**
 * P4-04 : crée des Contact à partir de l'ancien champ libre Client.contacts
 * (« Luna Cervi (cheffe de projet), Clémentine Burdet-Micolle »). Le champ libre
 * est conservé. Le premier contact devient le contact principal.
 *
 * Idempotent : ne traite que les clients qui n'ont encore aucun Contact.
 * Par défaut : simulation. `--apply` pour écrire.
 *
 *   npx tsx prisma/scripts/backfill-contacts.ts
 *   npx tsx prisma/scripts/backfill-contacts.ts --apply
 */
import { PrismaClient } from "@prisma/client";

import { parseLegacyContacts } from "../../src/lib/contacts";

const apply = process.argv.includes("--apply");
const db = new PrismaClient();

async function main() {
  const clients = await db.client.findMany({
    where: { contacts: { not: null }, contactRecords: { none: {} } },
    select: { id: true, name: true, contacts: true },
  });

  let total = 0;
  for (const client of clients) {
    const parsed = parseLegacyContacts(client.contacts);
    if (parsed.length === 0) continue;
    console.log(`${client.name}  « ${client.contacts} »`);
    parsed.forEach((contact, index) => {
      console.log(`   ${index === 0 ? "★" : " "} ${contact.name}${contact.role ? ` (${contact.role})` : ""}`);
    });
    total += parsed.length;
    if (apply) {
      await db.contact.createMany({
        data: parsed.map((contact, index) => ({
          clientId: client.id,
          name: contact.name,
          role: contact.role,
          isPrimary: index === 0,
        })),
      });
    }
  }
  console.log(
    `${total} contacts ${apply ? "créés" : "à créer"}.` + (apply ? "" : " Simulation : relancez avec --apply pour écrire."),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
