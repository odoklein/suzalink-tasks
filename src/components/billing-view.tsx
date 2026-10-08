"use client";

import { Download } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { PrimaryButton } from "@/components/dialog";
import { billingCsv, type BillingRow, formatEuros, monthLabel } from "@/lib/extras";
import { plural } from "@/lib/plural";

export type BillingExtra = BillingRow & {
  id: string;
  projectId: string;
  projectSlug: string;
  projectKey: string;
};

export function BillingView({ extras }: { extras: BillingExtra[] }) {
  const exportCsv = () => {
    if (extras.length === 0) {
      toast.error("Aucun avenant à exporter.");
      return;
    }
    const csv = billingCsv(extras);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `avenants-a-facturer-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("Fichier CSV téléchargé");
  };

  // Regroupement par mois puis par client
  const byMonth = new Map<string, BillingExtra[]>();
  for (const extra of extras) {
    const key = extra.approvedAt ? monthLabel(extra.approvedAt) : "Date inconnue";
    const list = byMonth.get(key) ?? [];
    list.push(extra);
    byMonth.set(key, list);
  }

  const totalCents = extras.reduce((sum, e) => sum + (e.amountCents ?? 0), 0);

  return (
    <div className="mx-auto max-w-[980px] px-4 py-6 sm:px-8 sm:py-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight">Facturation</h1>
          <p className="mt-1 text-[14px] text-muted">
            Avenants acceptés en attente de facturation dans votre outil comptable.
          </p>
        </div>
        {extras.length > 0 && (
          <PrimaryButton type="button" onClick={exportCsv}>
            <Download className="size-4" /> Exporter le CSV ({plural(extras.length, "avenant")})
          </PrimaryButton>
        )}
      </div>

      <div className="mt-6 rounded-xl border border-line bg-surface p-4 shadow-card">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-[13px] text-muted">Total à facturer</span>
          <span className="tabular text-[20px] font-semibold">{formatEuros(totalCents)} HT</span>
        </div>
      </div>

      {extras.length === 0 ? (
        <p className="mt-8 text-center text-[13px] text-muted">
          Aucun avenant en attente de facturation. Dès qu’un client valide un avenant, il apparaîtra ici.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {[...byMonth.entries()].map(([month, monthExtras]) => (
            <section key={month} className="space-y-3">
              <h2 className="text-[15px] font-semibold capitalize text-ink">{month}</h2>
              <ul className="divide-y divide-line rounded-xl border border-line bg-surface shadow-card">
                {monthExtras.map((extra) => (
                  <li key={extra.id} className="flex flex-wrap items-center gap-3 p-4 text-[13px]">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium text-ink">{extra.client}</span>
                        <span className="text-muted">·</span>
                        <Link
                          href={`/projects/${extra.projectSlug}?tab=avenants`}
                          className="font-medium text-ink hover:underline"
                        >
                          {extra.project}
                        </Link>
                        <span className="font-mono text-[11px] text-muted">AV-{extra.number}</span>
                      </div>
                      <p className="mt-0.5 text-ink-2">{extra.title}</p>
                      {extra.approvedBy && (
                        <p className="mt-0.5 text-[11px] text-muted">Validé par {extra.approvedBy}</p>
                      )}
                    </div>
                    <div className="tabular text-right font-semibold">
                      {extra.amountCents !== null ? `${formatEuros(extra.amountCents)} HT` : "Non chiffré"}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
