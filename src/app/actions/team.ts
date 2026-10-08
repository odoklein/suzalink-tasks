"use server";

import bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { revalidatePath } from "next/cache";

import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";
import { isWeakPin } from "@/lib/pin";

export type MemberState = { error?: string; pin?: string; name?: string } | undefined;

const MEMBER_COLORS = ["#2B59F2", "#1D9A62", "#C98206", "#B04FA8", "#E5533D", "#1F8A9E", "#6A5AE0", "#55606E"];

async function requireAdmin() {
  const { userId } = await verifySession();
  const user = await db.user.findUnique({ where: { id: userId }, select: { role: true } });
  return user?.role === "ADMIN";
}

/** Code à 6 chiffres sans suite ni chiffre répété (mêmes règles que « Changer le code »). */
function randomPin() {
  for (;;) {
    const pin = String(randomInt(0, 1_000_000)).padStart(6, "0");
    if (isWeakPin(pin)) continue;
    return pin;
  }
}

/** Ajoute un membre : le code est généré et affiché une seule fois à l'administrateur. */
export async function addMember(_state: MemberState, formData: FormData): Promise<MemberState> {
  if (!(await requireAdmin())) return { error: "Réservé aux administrateurs." };

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = formData.get("role") === "ADMIN" ? "ADMIN" : "MEMBER";
  if (!name) return { error: "Renseignez le nom." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "Cette adresse email n'est pas valide." };
  if (await db.user.findUnique({ where: { email }, select: { id: true } })) {
    return { error: "Un compte existe déjà avec cet email." };
  }

  const pin = randomPin();
  const count = await db.user.count();
  await db.user.create({
    data: { name, email, role, color: MEMBER_COLORS[count % MEMBER_COLORS.length], passwordHash: await bcrypt.hash(pin, 12) },
  });
  revalidatePath("/", "layout");
  return { pin, name };
}

/** Nouveau code pour un membre (code oublié ou compte bloqué). */
export async function resetMemberPin(userId: string): Promise<MemberState> {
  if (!(await requireAdmin())) return { error: "Réservé aux administrateurs." };
  const member = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
  if (!member) return { error: "Membre introuvable." };

  const pin = randomPin();
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: await bcrypt.hash(pin, 12), failedLogins: 0, lockedUntil: null },
  });
  return { pin, name: member.name };
}
