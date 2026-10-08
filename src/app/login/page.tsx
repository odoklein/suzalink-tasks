import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decrypt, SESSION_COOKIE } from "@/lib/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

export default async function LoginPage() {
  // Déjà connecté avec une session valide : direction l'accueil.
  // (Un cookie invalide reste ici, sans boucle de redirection.)
  const session = await decrypt((await cookies()).get(SESSION_COOKIE)?.value);
  if (session?.userId) redirect("/");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg px-5 py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center text-center">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-ink text-[20px] font-bold text-bg">
            S
          </span>
          <h1 className="mt-5 font-display text-[26px] font-semibold tracking-tight">Suzali Tasks</h1>
          <p className="mt-1 text-[15px] text-muted">Connectez-vous pour voir vos projets.</p>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-7">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-[13px] text-muted">
          Code oublié ? Demandez à Odo ou Hichem.
        </p>
      </div>
    </main>
  );
}
