"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { safe } from "@/lib/action";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { attemptLogin, invalidMessage, lockedMessage } from "@/lib/login-attempts";
import { prismaAttemptStore } from "@/lib/login-store";
import { safeNextPath } from "@/lib/next-path";
import { isWeakPin } from "@/lib/pin";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = { error?: string; success?: string } | undefined;

/**
 * `lockedUntil` (ISO) : compte bloqué jusqu'à cet instant ; le formulaire affiche un compte à rebours.
 * `next` : connexion réussie, chemin (validé) où aller. Le formulaire retient alors l'email et navigue.
 */
export type LoginState = { error?: string; lockedUntil?: string; next?: string } | undefined;

const PIN = /^\d{6}$/;
// Hash factice : on compare toujours, pour que la réponse prenne le même temps
// que l'email existe ou non (ne pas révéler quels comptes existent).
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5VbAlyAIgwPRfLJOrLu0ofRdyxGoOHi";

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  return safe(async () => {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const pin = String(formData.get("pin") ?? "");
    if (!email) return { error: "Renseignez votre email." };
    if (!PIN.test(pin)) return { error: "Entrez les 6 chiffres de votre code." };

    const user = await db.user.findUnique({ where: { email } });
    if (!user || !user.active) {
      // Même durée et même message que pour un compte existant.
      await bcrypt.compare(pin, DUMMY_HASH);
      return { error: invalidMessage(null) };
    }

    // L'essai est réservé atomiquement AVANT bcrypt : des requêtes parallèles ne dépassent plus la limite.
    const outcome = await attemptLogin(prismaAttemptStore, user.id, () => bcrypt.compare(pin, user.passwordHash));
    if (outcome.kind === "locked") {
      return { error: lockedMessage(outcome.until), lockedUntil: outcome.until.toISOString() };
    }
    if (outcome.kind === "invalid") return { error: invalidMessage(outcome.remaining) };

    await createSession(user.id, user.sessionVersion);
    // Pas de redirect() ici : le client doit d'abord savoir que la connexion a réussi pour retenir l'email.
    return { next: safeNextPath(formData.get("next")) };
  });
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

/** « Se déconnecter de tous les appareils » : la version de session change, tous les jetons existants sont refusés. */
export async function logoutEverywhere() {
  const { userId } = await verifySession();
  await db.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } });
  await deleteSession();
  redirect("/login");
}

export async function changePin(_state: FormState, formData: FormData): Promise<FormState> {
  return safe(async () => {
    const { userId } = await verifySession();
    const current = String(formData.get("current") ?? "");
    const next = String(formData.get("next") ?? "");
    const confirm = String(formData.get("confirm") ?? "");

    if (!PIN.test(next)) return { error: "Le nouveau code doit faire exactement 6 chiffres." };
    if (next !== confirm) return { error: "Les deux nouveaux codes ne correspondent pas." };
    if (isWeakPin(next)) {
      return { error: "Code trop facile à deviner (suite ou chiffre répété)." };
    }

    const user = await db.user.findUnique({ where: { id: userId } });
    if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
      return { error: "Le code actuel est incorrect." };
    }

    // Nouveau code : les autres appareils sont déconnectés ; celui-ci reçoit un jeton à la nouvelle version.
    const updated = await db.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(next, 12), sessionVersion: { increment: 1 }, mustChangePin: false },
      select: { sessionVersion: true },
    });
    await createSession(userId, updated.sessionVersion);
    revalidatePath("/", "layout"); // lève le passage obligé par Paramètres (P1-14)
    return { success: "Code PIN mis à jour. Vos autres appareils ont été déconnectés." };
  });
}
