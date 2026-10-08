import { ChevronLeft } from "lucide-react";
import Link from "next/link";

/** Gabarit commun des sous-pages de Paramètres. */
export function SettingsSubpage({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
      <div className="mx-auto max-w-[720px] px-4 py-6 sm:px-8 sm:py-8">
        <Link href="/settings" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
          <ChevronLeft className="size-4" /> Paramètres
        </Link>
        <h1 className="mt-2 font-display text-[28px] font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
        {children}
      </div>
    </div>
  );
}

export function SettingsCard({ title, description, children }: { title: string; description?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="mt-6 rounded-xl border border-line bg-surface p-5 shadow-card">
      <h2 className="font-display text-[17px] font-semibold">{title}</h2>
      {description && <div className="mt-1 text-[13px] text-muted">{description}</div>}
      {children}
    </section>
  );
}
