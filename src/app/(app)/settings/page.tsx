import type { Metadata } from "next";
import { cookies } from "next/headers";

import { Avatar } from "@/components/primitives";
import { getCurrentUser } from "@/lib/dal";
import { db } from "@/lib/db";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

import { PasswordForm } from "./password-form";
import { TeamSection } from "./team-section";
import { ThemePreference } from "./theme-preference";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

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
      <div className="mx-auto max-w-[var(--page-narrow)] px-4 py-6 sm:px-8 sm:py-8">
        <h1 className="font-display text-h1 font-semibold tracking-tight">Paramètres</h1>

        <section className="mt-6 flex items-center gap-4 rounded-lg border border-line bg-surface p-5 shadow-card">
          <Avatar name={user.name} color={user.color} size={44} />
          <div>
            <p className="text-title font-semibold tracking-[-0.01em]">{user.name}</p>
            <p className="text-ui text-muted">
              {user.email} · {user.role === "ADMIN" ? "Administrateur" : "Membre"}
            </p>
          </div>
        </section>

        <section aria-labelledby="preferences" className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 id="preferences" className="text-title font-semibold tracking-[-0.01em]">Préférences</h2>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-ui font-medium">Thème</p>
              <p className="text-xs text-muted">« Système » suit le réglage clair ou sombre de l’appareil.</p>
            </div>
            <ThemePreference initial={theme} />
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-card">
          <h2 className="text-title font-semibold tracking-[-0.01em]">Code PIN</h2>
          <p className="mt-1 text-ui text-muted">
            6 chiffres, ni suite (123456) ni chiffre répété (111111). Après 5 erreurs, le compte est bloqué 15 minutes.
          </p>
          <PasswordForm />
        </section>

        {user.role === "ADMIN" && (
          <section className="mt-6 rounded-lg border border-line bg-surface p-5 shadow-card">
            <h2 className="text-title font-semibold tracking-[-0.01em]">Équipe</h2>
            <p className="mt-1 text-ui text-muted">
              Ajoutez un membre ou redonnez un code à quelqu&apos;un qui l&apos;a oublié ou dont le compte est bloqué.
            </p>
            <TeamSection members={members} currentUserId={user.id} />
          </section>
        )}
      </div>
    </div>
  );
}
