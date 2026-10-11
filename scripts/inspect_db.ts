import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({ select: { id: true, name: true, email: true, role: true } });
  const clients = await db.client.findMany({ select: { id: true, name: true, kind: true } });
  const projects = await db.project.findMany({ select: { id: true, name: true, slug: true, key: true, status: true } });

  console.log("USERS:", JSON.stringify(users, null, 2));
  console.log("CLIENTS:", JSON.stringify(clients, null, 2));
  console.log("PROJECTS:", JSON.stringify(projects, null, 2));

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("ERROR:", e);
  await db.$disconnect();
  process.exit(1);
});
