"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { createSession, deleteSession } from "@/lib/session";

export type FormState = { error?: string; success?: string } | undefined;

export async function login(_state: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Renseignez votre email et votre mot de passe." };

  const user = await db.user.findUnique({ where: { email } });
  const valid = user ? await bcrypt.compare(password, user.passwordHash) : false;
  if (!user || !valid) return { error: "Email ou mot de passe incorrect." };

  await createSession(user.id);
  redirect("/");
}

export async function logout() {
  await deleteSession();
  redirect("/login");
}

export async function changePassword(_state: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await verifySession();
  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (next.length < 10) return { error: "Le nouveau mot de passe doit faire au moins 10 caractères." };
  if (next !== confirm) return { error: "Les deux nouveaux mots de passe ne correspondent pas." };

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) {
    return { error: "Le mot de passe actuel est incorrect." };
  }

  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(next, 12) },
  });
  return { success: "Mot de passe mis à jour." };
}
