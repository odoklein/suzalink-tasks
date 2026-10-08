"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { recordLoginEvent } from "@/lib/login-events";
import { isWeakPin } from "@/lib/pin";
import { rateLimitCurrentIp } from "@/lib/rate-limit";
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
  if (!PIN.test(pin)) return { error: "Entrez les 6 chiffres de votre code." };

  // Limite par adresse IP, en plus du blocage par compte.
  const limited = await rateLimitCurrentIp("login");
  if (!limited.allowed) {
    const minutes = Math.ceil(limited.retryAfterSec / 60);
    return { error: `Trop de tentatives depuis cette connexion. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  const user = await db.user.findUnique({ where: { email } });

  if (user?.lockedUntil && user.lockedUntil > new Date()) {
    await recordLoginEvent({ email, success: false, userId: user.id });
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return { error: `Trop d’erreurs. Réessayez dans ${minutes} minute${minutes > 1 ? "s" : ""}.` };
  }

  const valid = await bcrypt.compare(pin, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) {
    await recordLoginEvent({ email, success: false, userId: user?.id });
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
      if (locked) return { error: `Trop d’erreurs. Réessayez dans ${LOCK_MINUTES} minutes.` };
    }
    // Même message que l'email existe ou non.
    return { error: "Email ou code incorrect." };
  }

  if (user.failedLogins > 0 || user.lockedUntil) {
    await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  }
  await recordLoginEvent({ email, success: true, userId: user.id });
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
}
