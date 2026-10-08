import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { readSession } from "@/lib/dal";
import { db } from "@/lib/db";
import { joinOr, NNBSP } from "@/lib/fr";
import { safeNextPath } from "@/lib/next-path";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

/** Prénoms des administrateurs actifs (lecture publique, noms seulement) pour « Code oublié ? ». */
async function adminFirstNames() {
  try {
    const admins = await db.user.findMany({
      where: { role: "ADMIN", active: true },
      select: { name: true },
      orderBy: { name: "asc" },
    });
    return admins.map((admin) => admin.name.split(" ")[0]);
  } catch {
    return []; // base indisponible : la page de connexion s'affiche quand même
  }
}

export default async function LoginPage(props: PageProps<"/login">) {
  const { next: rawNext } = await props.searchParams;
  const next = safeNextPath(Array.isArray(rawNext) ? rawNext[0] : rawNext);
  // Déjà connecté avec une session valide : direction l'accueil.
  // (Un cookie invalide ou révoqué reste ici, sans boucle de redirection.)
  const session = await readSession();
  if (session) redirect(next);
  const admins = await adminFirstNames();

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-xl bg-ink text-h2 font-bold text-bg">
            S
          </span>
          <h1 className="mt-5 font-display text-h1 font-semibold tracking-tight">Suzali Tasks</h1>
          <p className="mt-1 text-body text-muted">Connectez-vous pour voir vos projets.</p>
        </div>

        <div className="mt-8 rounded-xl border border-line bg-surface p-6 shadow-card sm:p-7">
          <LoginForm next={next} />
        </div>

        <p className="mt-6 text-center text-ui text-muted">
          {admins.length ? `Code oublié${NNBSP}? Demandez à ${joinOr(admins)}.` : `Code oublié${NNBSP}? Demandez à un administrateur.`}
        </p>
      </div>
    </main>
  );
}
