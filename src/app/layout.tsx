import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";

import "./globals.css";

const body = Instrument_Sans({ subsets: ["latin"], variable: "--font-body", display: "swap" });
// Bricolage Grotesque : uniquement à partir de 22 px (h1 de page, héros d’Aujourd’hui,
// valeurs des statistiques, titres d’états vides, connexion). Les titres de cartes, de
// dialogues et de panneaux restent en Instrument Sans 17 px semi-gras.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  axes: ["opsz", "wdth"],
  variable: "--font-display-face",
  display: "swap",
});
// JetBrains Mono : identifiants de tâche, PIN et clés uniquement, jamais les dates.
const code = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-code",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: { default: "Suzali Tasks", template: "%s · Suzali Tasks" },
  description: "Projets et tâches de l'agence Suzali Conseil.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f2" },
    { media: "(prefers-color-scheme: dark)", color: "#101216" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${body.variable} ${display.variable} ${code.variable}`}>
      <body>
        {children}
        {/* En bas au centre : ne couvre plus le bouton « Commenter » du tiroir. */}
        <Toaster
          position="bottom-center"
          containerAriaLabel="Notifications"
          toastOptions={{
            closeButtonAriaLabel: "Fermer",
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
