"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = { error?: string; success?: string } | undefined;

const PIN = /^\d{6}$/;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
// Hash factice : on compare toujours, pour que la réponse prenne le même temps
// que l'email existe ou non (ne pas révéler quels comptes existent).
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5VbAlyAIgwPRfLJOrLu0ofRdyxGoOHi";

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const pin = String(formData.get("pin") ?? "");
  if (!email) return { error: "Renseignez votre email." };
  if (!PIN.test(pin)) return { error: "Le code PIN fait 6 chiffres." };

  const user = await db.user.findUnique({ where: { email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Trop d'essais. Réessayez dans ${minutes} min.` };
  }

  const valid = await bcrypt.compare(pin, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    if (user) {
      const failed = user.failedLogins + 1;
      const locked = failed >= MAX_ATTEMPTS;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLogins: locked ? 0 : failed,
          lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60000) : null,
        },
      });
      if (locked) return { error: `Trop d'essais. Compte bloqué ${LOCK_MINUTES} min.` };
      const left = MAX_ATTEMPTS - failed;
      return { error: `Email ou code incorrect. Encore ${left} essai${left > 1 ? "s" : ""}.` };
    }
    return { error: "Email ou code incorrect." };
  }

  if (user.failedLogins > 0 || user.lockedUntil) {
    await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function changePin(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!PIN.test(next)) return { error: "Le nouveau code doit faire exactement 6 chiffres." };
  if (next !== confirm) return { error: "Les deux nouveaux codes ne correspondent pas." };
  if (/^(\d)\1{5}$/.test(next) || "0123456789".includes(next) || "9876543210".includes(next)) {
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
}
