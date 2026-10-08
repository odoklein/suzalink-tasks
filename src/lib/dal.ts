import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/lib/db";
import { decrypt, SESSION_COOKIE } from "@/lib/session";

/**
 * Session valide, sans redirection : signature correcte, compte actif et même version de session
 * que l'utilisateur en base (une réinitialisation du code ou « se déconnecter partout » l'incrémente).
 * Mise en cache pour la requête : une seule lecture en base par rendu.
 */
export const readSession = cache(async () => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await decrypt(token);
  if (!session?.userId) return null;
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { sessionVersion: true, active: true },
  });
  if (!user || !user.active || user.sessionVersion !== (session.v ?? 0)) return null;
  return { userId: session.userId };
});

/** Vérifie la session ; supprime le cookie révoqué et redirige vers /login si elle est absente ou invalide. */
export const verifySession = cache(async () => {
  const session = await readSession();
  if (!session) {
    try {
      // Possible dans une Server Action ; interdit pendant le rendu d'une page (on ignore alors l'erreur :
      // la page de connexion ne tient pas compte d'un cookie révoqué, et la reconnexion le remplace).
      (await cookies()).delete(SESSION_COOKIE);
    } catch {
      // rendu de page : cookie laissé en place
    }
    redirect("/login");
  }
  return session;
});

/** Utilisateur connecté, sans le hash du mot de passe. */
export const getCurrentUser = cache(async () => {
  const { userId } = await verifySession();
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, color: true, role: true, mustChangePin: true },
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
