import type { Metadata } from "next";

import { Avatar } from "@/components/primitives";
import { getCurrentUser } from "@/lib/dal";

import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "Paramètres" };

export default async function SettingsPage() {
  const user = await getCurrentUser();

  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[640px] px-8 py-8">
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
      </div>
    </div>
  );
}
