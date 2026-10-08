import "server-only";

import { redirect } from "next/navigation";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

/** Vrai si l'utilisateur connecté est administrateur (Server Actions). */
export async function isAdmin(): Promise<boolean> {
  const { userId } = await verifySession();
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "ADMIN";
}

/** Pages réservées aux administrateurs : les autres reviennent à Paramètres. */
export async function requireAdminPage() {
  const { userId } = await verifySession();
  const user = await db.user.findUnique({ where: { id: userId }, select: { id: true, role: true, name: true } });
  if (user?.role !== "ADMIN") redirect("/settings");
  return user;
}
