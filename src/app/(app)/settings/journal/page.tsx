import type { Metadata } from "next";

import { requireAdminPage } from "@/lib/admin";
import { db } from "@/lib/db";
import { formatParis } from "@/lib/time";
import { cn } from "@/lib/utils";

import { SettingsCard, SettingsSubpage } from "../settings-page";

export const metadata: Metadata = { title: "Journal des connexions" };

/** Navigateur lisible à partir du user-agent (approximatif, pour repérer un appareil inconnu). */
function device(ua: string | null) {
  if (!ua) return "Appareil inconnu";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  const browser = /Edg\//.test(ua) ? "Edge" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "";
  return [browser, os].filter(Boolean).join(" · ") || "Autre";
}

export default async function JournalPage() {
  await requireAdminPage();
  const events = await db.loginEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { name: true } } },
  });

  return (
    <SettingsSubpage title="Journal des connexions" description="Les 100 dernières tentatives de connexion, réussies ou non.">
      <SettingsCard title="Connexions">
        {events.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">Aucune connexion enregistrée pour l’instant.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3 py-2 text-[13px]">
                <span className={cn("w-16 shrink-0 font-medium", event.success ? "text-st-done" : "text-danger")}>
                  {event.success ? "Réussie" : "Échec"}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {event.user?.name ?? event.email}
                  {event.method === "GOOGLE" && <span className="ml-1.5 text-[12px] text-muted">via Google</span>}
                </span>
                <span className="text-[12px] text-muted">
                  {device(event.ua)}
                  {event.ip ? ` · ${event.ip}` : ""}
                </span>
                <time dateTime={event.createdAt.toISOString()} className="tabular w-28 text-right text-[12px] text-muted">
                  {formatParis(event.createdAt, "d MMM HH'h'mm")}
                </time>
              </li>
            ))}
          </ul>
        )}
      </SettingsCard>
    </SettingsSubpage>
  );
}
