import type { Metadata } from "next";
import Link from "next/link";

import { Avatar } from "@/components/primitives";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";

import { PasswordForm } from "./password-form";
import { TeamSection } from "./team-section";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getCurrentUser();

  const members =
    user.role === "ADMIN"
      ? (
          await db.user.findMany({
            orderBy: [{ role: "asc" }, { name: "asc" }],
            select: {
              id: true,
              name: true,
              email: true,
              color: true,
              role: true,
              lockedUntil: true,
              _count: { select: { assignedTasks: { where: { status: { not: "DONE" } } } } },
            },
          })
        ).map((member) => ({
          id: member.id,
          name: member.name,
          email: member.email,
          color: member.color,
          role: member.role,
          openTasks: member._count.assignedTasks,
          locked: !!member.lockedUntil && member.lockedUntil > new Date(),
        }))
      : [];

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-[28px] font-semibold tracking-tight">Paramètres</h1>

        <section className="mt-6 flex items-center gap-4 rounded-xl border border-line bg-surface p-5 shadow-card">
          <Avatar name={user.name} color={user.color} size={44} />
          <div>
            <p className="font-display text-[17px] font-semibold">{user.name}</p>
            <p className="text-[13px] text-muted">
              {user.email} · {user.role === "ADMIN" ? "Administrateur" : "Membre"}
            </p>
          </div>
        </section>

        <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-[17px] font-semibold">Code PIN</h2>
          <p className="mt-1 text-[13px] text-muted">
            6 chiffres, ni suite (123456) ni chiffre répété (111111). Après 5 erreurs, le compte est bloqué 15 minutes.
          </p>
          <PasswordForm />
        </section>

        <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-[17px] font-semibold">Modèles de projet</h2>
          <p className="mt-1 text-[13px] text-muted">
            Jalons, pages et tâches de départ proposés à la création d&apos;un projet (site vitrine, e-commerce…).
          </p>
          <Link href="/settings/templates" className="mt-3 inline-block text-[13px] font-medium text-accent hover:underline">
            Gérer les modèles
          </Link>
        </section>

        {user.role === "ADMIN" && (
          <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
            <h2 className="font-display text-[17px] font-semibold">Équipe</h2>
            <p className="mt-1 text-[13px] text-muted">
              Ajoutez un membre ou redonnez un code à quelqu&apos;un qui l&apos;a oublié ou dont le compte est bloqué.
            </p>
            <TeamSection members={members} currentUserId={user.id} />
          </section>
        )}
      </div>
    </div>
  );
}
