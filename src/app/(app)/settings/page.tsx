import { LogOut } from "lucide-react";
import type { Metadata } from "next";

import { logoutEverywhere } from "@/app/actions/auth";

import { Avatar } from "@/components/primitives";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";

import { PasswordForm } from "./password-form";
import { TeamSection } from "./team-section";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage(props: PageProps<"/settings">) {
  const user = await getCurrentUser();
  const firstLogin = user.mustChangePin || (await props.searchParams)["premiere-connexion"] === "1";

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
              active: true,
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
          active: member.active,
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

        {user.mustChangePin && (
          <p role="status" className="mt-6 rounded-xl border border-accent/40 bg-accent-soft px-5 py-4 text-[14px] text-ink">
            Bienvenue ! Le code que vous avez reçu est provisoire : choisissez votre propre code pour continuer.
          </p>
        )}

        <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-[17px] font-semibold">Code PIN</h2>
          <p className="mt-1 text-[13px] text-muted">
            6 chiffres, ni suite (123456) ni chiffre répété (111111). Après 5 erreurs, le compte est bloqué 15 minutes.
          </p>
          <PasswordForm firstLogin={firstLogin} />
        </section>

        <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
          <h2 className="font-display text-[17px] font-semibold">Sessions</h2>
          <p className="mt-1 text-[13px] text-muted">
            Un téléphone perdu, un ordinateur partagé ? Déconnectez tous les appareils, y compris celui-ci.
          </p>
          <form action={logoutEverywhere} className="mt-4">
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink"
            >
              <LogOut className="size-4" />
              Se déconnecter de tous les appareils
            </button>
          </form>
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
