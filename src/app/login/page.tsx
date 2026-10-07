import { FileSpreadsheet, Hourglass, Rocket } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { decrypt, SESSION_COOKIE } from "@/lib/session";

import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Connexion" };

// Le panneau de marque garde le même rendu sombre quel que soit le thème.
const PANEL = {
  bg: "#0d1014",
  ink: "#eceef1",
  muted: "#8d939d",
  line: "#242a31",
  card: "#161a20",
};

const COLUMNS = [
  {
    label: "En cours",
    tone: "#6f8cff",
    cards: [{ code: "BG-21", title: "Manifeste : nouveau titre", zone: "Brasserie" }],
  },
  {
    label: "En attente client",
    tone: "#f0aa2c",
    cards: [
      { code: "BG-11", title: "Médailles en haute définition", zone: "Catalogue" },
      { code: "BG-20", title: "Frise chronologique à revoir", zone: "Brasserie" },
    ],
  },
  {
    label: "Fait",
    tone: "#3fc488",
    cards: [
      { code: "BG-14", title: "Vidéo du bloc Brasserie", zone: "Homepage" },
      { code: "BG-15", title: "Image tireuse", zone: "Homepage" },
    ],
  },
];

export default async function LoginPage() {
  // Déjà connecté avec une session valide : direction l'accueil.
  // (Un cookie invalide reste ici, sans boucle de redirection.)
  const session = await decrypt((await cookies()).get(SESSION_COOKIE)?.value);
  if (session?.userId) redirect("/");

  return (
    <main className="grid min-h-dvh bg-bg lg:grid-cols-[1.15fr_1fr]">
      <section
        className="relative hidden overflow-hidden px-12 py-11 lg:flex lg:flex-col"
        style={{ background: PANEL.bg, color: PANEL.ink }}
      >
        {/* Halo discret derrière l'aperçu */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-40 top-24 size-[38rem] rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(closest-side, rgba(111,140,255,0.35), transparent)" }}
        />

        <div className="relative flex items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg font-display text-[15px] font-bold" style={{ background: PANEL.ink, color: PANEL.bg }}>
            S
          </span>
          <span className="font-display text-[15px] font-semibold tracking-tight">Suzali Tasks</span>
        </div>

        <div className="relative mt-16 max-w-[30rem]">
          <h1 className="font-display text-[44px] font-semibold leading-[1.02] tracking-tight">
            Chaque retour client, suivi jusqu&apos;à la mise en ligne.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed" style={{ color: PANEL.muted }}>
            Les projets de l&apos;agence, les retours des clients et ce qui a été livré, au même endroit.
          </p>
        </div>

        {/* Aperçu vivant du tableau */}
        <div aria-hidden className="relative mt-12 flex gap-3">
          {COLUMNS.map((column, columnIndex) => (
            <div key={column.label} className="relative w-[188px] shrink-0 rounded-xl p-2" style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${PANEL.line}` }}>
              <p className="flex items-center gap-2 px-1.5 pb-2 pt-1 text-[11px] font-semibold">
                <span className="size-2 rounded-full" style={{ background: column.tone }} />
                {column.label}
                <span style={{ color: PANEL.muted }}>{column.cards.length}</span>
              </p>
              <div className="space-y-2">
                {column.cards.map((card) => (
                  <MiniCard key={card.code} {...card} tone={column.tone} />
                ))}
              </div>
              {columnIndex === 0 && (
                // Une carte passe de « En cours » à « Fait », en boucle
                <div className="animate-glide absolute left-2 right-2 top-[118px]" style={{ ["--glide-x" as string]: "398px" }}>
                  <MiniCard code="BG-18" title="Titre Histoire validé" zone="Brasserie" tone="#3fc488" />
                </div>
              )}
            </div>
          ))}

          <div
            className="animate-float absolute -bottom-6 right-6 flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-[12px] shadow-2xl"
            style={{ background: PANEL.ink, color: PANEL.bg }}
          >
            <Rocket className="size-4" style={{ color: "#1d9a62" }} />
            <span>
              <strong className="font-semibold">Mise en ligne</strong> · 6 oct. à 15h48
            </span>
          </div>
        </div>

        <ul className="relative mt-auto grid grid-cols-3 gap-6 pt-14 text-[13px]">
          <Feature icon={<FileSpreadsheet className="size-4" />} title="Retours en un collage" text="Le tableau du client devient une liste de tâches." />
          <Feature icon={<Hourglass className="size-4" />} title="Bloqué côté client" text="Ce qui attend le client, et depuis combien de jours." />
          <Feature icon={<Rocket className="size-4" />} title="Livraisons datées" text="L'heure exacte de chaque mise en ligne." />
        </ul>
      </section>

      <section className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-[380px]">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <span className="flex size-8 items-center justify-center rounded-lg bg-ink font-display text-[15px] font-bold text-bg">S</span>
            <span className="font-display text-[15px] font-semibold tracking-tight">Suzali Tasks</span>
          </div>
          <h2 className="font-display text-[28px] font-semibold tracking-tight">Connexion</h2>
          <p className="mt-1.5 text-[14px] text-muted">Votre email, puis votre code à 6 chiffres.</p>
          <LoginForm />
          <p className="mt-10 text-[12px] leading-relaxed text-faint">
            Code oublié ou compte bloqué ? Un administrateur de l&apos;équipe peut le réinitialiser.
          </p>
        </div>
      </section>
    </main>
  );
}

function MiniCard({ code, title, zone, tone }: { code: string; title: string; zone: string; tone: string }) {
  return (
    <div className="rounded-lg p-2.5" style={{ background: PANEL.card, border: `1px solid ${PANEL.line}` }}>
      <p className="font-mono text-[10px]" style={{ color: PANEL.muted }}>{code}</p>
      <p className="mt-1 text-[12px] font-medium leading-snug">{title}</p>
      <p className="mt-2 flex items-center gap-1.5 text-[10px]" style={{ color: PANEL.muted }}>
        <span className="size-1.5 rounded-full" style={{ background: tone }} />
        {zone}
      </p>
    </div>
  );
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <li>
      <span className="flex size-8 items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.06)", color: PANEL.ink }}>
        {icon}
      </span>
      <p className="mt-3 font-semibold">{title}</p>
      <p className="mt-1 leading-relaxed" style={{ color: PANEL.muted }}>{text}</p>
    </li>
  );
}
