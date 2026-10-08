"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";

import { isValidEmail } from "@/lib/contacts";
import { verifySession } from "@/lib/dal";
import { db } from "@/lib/db";

export type ContactInput = {
  name: string;
  role?: string;
  email?: string;
  phone?: string;
  isPrimary?: boolean;
};

function clean(input: ContactInput) {
  const name = input.name.trim().slice(0, 120);
  const email = input.email?.trim().toLowerCase() || null;
  if (!name) return { error: "Renseignez le nom du contact." } as const;
  if (email && !isValidEmail(email)) return { error: "Cette adresse email n’est pas valide." } as const;
  return {
    data: {
      name,
      role: input.role?.trim().slice(0, 120) || null,
      email,
      phone: input.phone?.trim().slice(0, 40) || null,
    },
  } as const;
}

const uniqueEmailError = { error: "Un contact existe déjà avec cette adresse email." } as const;

/** Ajoute un contact ; le premier contact d'un client devient le contact principal. */
export async function createContact(clientId: string, input: ContactInput) {
  await verifySession();
  const cleaned = clean(input);
  if ("error" in cleaned) return cleaned;
  try {
    await db.$transaction(async (tx) => {
      const count = await tx.contact.count({ where: { clientId } });
      const isPrimary = input.isPrimary || count === 0;
      if (isPrimary) await tx.contact.updateMany({ where: { clientId }, data: { isPrimary: false } });
      await tx.contact.create({ data: { ...cleaned.data, clientId, isPrimary } });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return uniqueEmailError;
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

export async function updateContact(contactId: string, input: ContactInput) {
  await verifySession();
  const cleaned = clean(input);
  if ("error" in cleaned) return cleaned;
  try {
    await db.$transaction(async (tx) => {
      const current = await tx.contact.findUnique({ where: { id: contactId }, select: { clientId: true } });
      if (!current) throw new Error("Contact introuvable.");
      if (input.isPrimary) await tx.contact.updateMany({ where: { clientId: current.clientId }, data: { isPrimary: false } });
      await tx.contact.update({
        where: { id: contactId },
        data: { ...cleaned.data, ...(input.isPrimary ? { isPrimary: true } : {}) },
      });
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return uniqueEmailError;
    if (error instanceof Error && error.message === "Contact introuvable.") return { error: error.message };
    throw error;
  }
  revalidatePath("/", "layout");
  return { ok: true as const };
}

/** Supprime un contact ; si c'était le principal, le plus ancien restant le devient. */
export async function deleteContact(contactId: string) {
  await verifySession();
  await db.$transaction(async (tx) => {
    const contact = await tx.contact.delete({ where: { id: contactId }, select: { clientId: true, isPrimary: true } });
    if (!contact.isPrimary) return;
    const next = await tx.contact.findFirst({ where: { clientId: contact.clientId }, orderBy: { createdAt: "asc" }, select: { id: true } });
    if (next) await tx.contact.update({ where: { id: next.id }, data: { isPrimary: true } });
  });
  revalidatePath("/", "layout");
  return { ok: true as const };
}
