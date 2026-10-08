import { ChevronRight } from "lucide-react";
import Link from "next/link";

type SettingsLink = { href: string; label: string; description: string; adminOnly?: boolean };

/** Sous-pages de Paramètres. Chaque intégration ajoute sa ligne ici (une seule liste à fusionner). */
const LINKS: SettingsLink[] = [
  {
    href: "/settings/integrations",
    label: "Intégrations",
    description: "Derniers webhooks reçus, état du cron, travaux en échec.",
    adminOnly: true,
  },
];

export function SettingsLinks({ isAdmin }: { isAdmin: boolean }) {
  const links = LINKS.filter((link) => !link.adminOnly || isAdmin);
  if (links.length === 0) return null;
  return (
    <nav aria-label="Autres paramètres" className="mt-6 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
      <ul className="divide-y divide-line">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2">
              <span className="min-w-0 flex-1">
                <span className="block text-[14px] font-medium">{link.label}</span>
                <span className="block text-[13px] text-muted">{link.description}</span>
              </span>
              <ChevronRight className="size-4 text-faint" />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
