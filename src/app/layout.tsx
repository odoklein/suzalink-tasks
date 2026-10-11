import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "sonner";

import { parseTheme, THEME_COOKIE, themeAttribute } from "@/lib/theme";

import "./globals.css";

// Inter partout, une seule famille : l’axe de taille optique (opsz) resserre d’office les titres
// et les chiffres des statistiques, sans seconde police de titrage.
const body = Inter({ subsets: ["latin"], axes: ["opsz"], variable: "--font-body", display: "swap" });
// JetBrains Mono : identifiants de tâche, PIN et clés uniquement, jamais les dates.
const code = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Suzali Tasks", template: "%s · Suzali Tasks" },
  description: "Projets et tâches de l’agence Suzali Conseil.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f1f1f3" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0b0d" },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Le thème choisi (Paramètres › Préférences) est rendu par le serveur : pas de flash.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="fr" data-theme={themeAttribute(theme)} className={`${body.variable} ${code.variable}`}>
      <body>
        {children}
        {/* En bas au centre : ne couvre plus le bouton « Commenter » du tiroir. */}
        <Toaster
          position="bottom-center"
          containerAriaLabel="Notifications"
          toastOptions={{
            closeButtonAriaLabel: "Fermer",
            // Le style de sonner impose son rayon : le nôtre (rounded-xl) passe en important.
            className: "rounded-xl!",
            style: {
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              boxShadow: "var(--shadow-pop)",
            },
          }}
        />
      </body>
    </html>
  );
}
