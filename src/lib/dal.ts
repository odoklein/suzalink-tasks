import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

/** Vérifie la session ; redirige vers /login si elle est absente ou invalide. */
export const verifySession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decrypt(token);
  if (!session?.userId) redirect("/login");
  return { userId: session.userId };
});

/** Utilisateur connecté, sans le hash du mot de passe. */
export const getCurrentUser = cache(async () => {
  const { userId } = await verifySession();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, color: true, role: true },
  });
  if (!user) redirect("/login");
  return user;
});

export type CurrentUser = Awaited<ReturnType<typeof getCurrentUser>>;

/** Membres de l'équipe, pour les assignations. */
export const getTeam = cache(async () => {
  await verifySession();
  return db.user.findMany({
    select: { id: true, name: true, color: true },
    orderBy: { name: "asc" },
  });
});

export type TeamMember = Awaited<ReturnType<typeof getTeam>>[number];

/** Projets non archivés, pour la navigation et la palette de commandes. */
export const getProjectsNav = cache(async () => {
  await verifySession();
  return db.project.findMany({
    where: { archived: false },
    select: {
      id: true,
      name: true,
      slug: true,
      key: true,
      color: true,
      status: true,
      _count: { select: { tasks: { where: { status: { not: "DONE" } } } } },
    },
    // Ordre stable : la liste ne doit pas se réorganiser à chaque modification.
    orderBy: { name: "asc" },
  });
});

export type ProjectNavItem = Awaited<ReturnType<typeof getProjectsNav>>[number];

/** Clients et agences, pour la création de projet. */
export const getClients = cache(async () => {
  await verifySession();
  return db.client.findMany({
    select: { id: true, name: true, kind: true },
    orderBy: { name: "asc" },
  });
});

export type ClientOption = Awaited<ReturnType<typeof getClients>>[number];
