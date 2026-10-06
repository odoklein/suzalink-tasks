import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default function LoginPage() {
  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden overflow-hidden bg-ink p-12 text-bg lg:flex lg:flex-col lg:justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg bg-bg font-display text-[15px] font-bold text-ink">S</span>
          <span className="font-display text-[15px] font-semibold tracking-tight">Suzali Tasks</span>
        </div>

        {/* Aperçu stylisé du tableau : cinq colonnes de statut */}
        <div aria-hidden className="pointer-events-none absolute -right-24 top-1/2 flex -translate-y-1/2 rotate-[-6deg] gap-3 opacity-[0.16]">
          {[5, 3, 4, 2, 6].map((count, column) => (
            <div key={column} className="flex w-44 flex-col gap-2">
              {Array.from({ length: count }, (_, index) => (
                <div key={index} className="h-16 rounded-lg border border-bg/40" />
              ))}
            </div>
          ))}
        </div>

        <div className="relative max-w-md">
          <h1 className="font-display text-[44px] font-semibold leading-[1.02] tracking-tight">
            Chaque retour client, suivi jusqu&apos;à la mise en ligne.
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-bg/65">
            Projets, retours importés en un collage, tâches en attente du client et mises en ligne datées : tout ce qu&apos;il faut pour savoir où en est chaque site, et le prouver.
          </p>
        </div>
        <p className="relative text-[12px] text-bg/45">Suzali Conseil · usage interne</p>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-[26px] font-semibold tracking-tight">Connexion</h2>
          <p className="mt-1.5 text-[14px] text-muted">Avec votre compte de l&apos;équipe Suzali.</p>
          <LoginForm />
        </div>
      </section>
    </main>
  );
}
