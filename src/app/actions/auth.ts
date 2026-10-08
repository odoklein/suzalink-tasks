"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { safe } from "@/lib/action";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { attemptLogin, invalidMessage, lockedMessage } from "@/lib/login-attempts";
import { prismaAttemptStore } from "@/lib/login-store";
import { isWeakPin } from "@/lib/pin";
import { createSession, deleteSession } from "@/lib/session";

/** `lockedUntil` (ISO) : compte bloqué jusqu'à cet instant ; le formulaire affiche un compte à rebours. */
export type FormState = { error?: string; success?: string; lockedUntil?: string } | undefined;

const PIN = /^\d{6}$/;
// Hash factice : on compare toujours, pour que la réponse prenne le même temps
// que l'email existe ou non (ne pas révéler quels comptes existent).
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5VbAlyAIgwPRfLJOrLu0ofRdyxGoOHi";

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  return safe(async () => {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const pin = String(formData.get("pin") ?? "");
    if (!email) return { error: "Renseignez votre email." };
    if (!PIN.test(pin)) return { error: "Entrez les 6 chiffres de votre code." };

    const user = await db.user.findUnique({ where: { email } });
    if (!user) {
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

    await createSession(user.id);
    redirect("/");
  });
}

export async function logout() {
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

    await db.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(next, 12) },
    });
    return { success: "Code PIN mis à jour." };
  });
}
