"use client";

import type { RoundStatus } from "@prisma/client";
import { FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { closeRound, reopenRound } from "@/app/actions/rounds";
import { GhostButton, PrimaryButton } from "@/components/dialog";
import { QuickAdd } from "@/components/quick-add";
import { plural } from "@/lib/plural";
import { ROUND_STATUS_LABELS, roundCounts } from "@/lib/rounds";
import { formatParis } from "@/lib/time";
import type { TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export type RoundData = {
  id: string;
  label: string;
  receivedAt: Date;
  status: RoundStatus;
  rawText: string | null;
  fromContact: { name: string } | null;
  closedBy: { title: string; deployedAt: Date } | null;
};

/** Onglet « Retours » : une carte par lot de retours, avec son avancement. */
export function RoundsView({
  projectId,
  rounds,
  tasks,
  deliveries,
  onImport,
}: {
  projectId: string;
  rounds: RoundData[];
  tasks: TaskCard[];
  deliveries: { id: string; title: string; deployedAt: Date }[];
  onImport: () => void;
}) {
  if (rounds.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl px-6">
        <div className="rounded-xl border border-dashed border-line-strong bg-surface px-6 py-12 text-center">
          <p className="font-display text-[17px] font-semibold">Aucun lot de retours</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
            Chaque tableau de retours importé devient un lot : on voit d’un coup d’œil ce qui est fait, ce qui attend le client et ce qui reste.
          </p>
          <div className="mt-5 flex justify-center">
            <PrimaryButton type="button" onClick={onImport}>
              <FileSpreadsheet className="size-4" /> Importer des retours
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ul className="mx-auto w-full max-w-3xl space-y-3 px-6 pb-10">
      {rounds.map((round) => (
        <RoundCard
          key={round.id}
          projectId={projectId}
          round={round}
          tasks={tasks.filter((task) => task.roundId === round.id)}
          deliveries={deliveries}
        />
      ))}
    </ul>
  );
}

function RoundCard({
  projectId,
  round,
  tasks,
  deliveries,
}: {
  projectId: string;
  round: RoundData;
  tasks: TaskCard[];
  deliveries: { id: string; title: string; deployedAt: Date }[];
}) {
  const pathname = usePathname();
  const [closing, setClosing] = useState(false);
  const [deliveryId, setDeliveryId] = useState(deliveries[0]?.id ?? "");
  const [pending, startTransition] = useTransition();
  const counts = roundCounts(tasks);
  const open = round.status === "OPEN";

  const close = () =>
    startTransition(async () => {
      const result = await closeRound(round.id, deliveryId || null);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Lot « ${round.label} » clôturé`);
      setClosing(false);
    });

  const reopen = () =>
    startTransition(async () => {
      await reopenRound(round.id);
      toast.success(`Lot « ${round.label} » rouvert`);
    });

  const segments = [
    { key: "done", count: counts.done, color: "var(--st-done)", label: "faites" },
    { key: "waiting", count: counts.waiting, color: "var(--st-waiting)", label: "chez le client" },
    { key: "remaining", count: counts.remaining, color: "var(--line-strong)", label: "restantes" },
  ];

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-[15px] font-semibold">{round.label}</h2>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-medium",
            open ? "bg-accent-soft text-accent" : "bg-sunken text-ink-2",
          )}
        >
          {ROUND_STATUS_LABELS[round.status]}
        </span>
        <span className="text-[12px] text-muted">
          Reçus le {formatParis(round.receivedAt, "d MMM yyyy")}
          {round.fromContact && ` · de ${round.fromContact.name}`}
        </span>
      </div>

      <p className="tabular mt-2 text-[13px] text-ink-2">
        {plural(counts.done, "faite")} · {counts.waiting} chez le client · {plural(counts.remaining, "restante")}
        <span className="text-muted"> sur {plural(counts.total, "tâche")}</span>
      </p>
      <div
        role="img"
        aria-label={`${counts.done} faites, ${counts.waiting} chez le client, ${counts.remaining} restantes`}
        className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-sunken"
      >
        {segments.map((segment) =>
          segment.count ? <span key={segment.key} style={{ flex: segment.count, backgroundColor: segment.color }} /> : null,
        )}
      </div>

      {round.closedBy && (
        <p className="mt-2 text-[12px] text-muted">
          Livré avec «&#8239;{round.closedBy.title}&#8239;» le {formatParis(round.closedBy.deployedAt, "d MMM")}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={`${pathname}?vue=liste&source=${encodeURIComponent(round.label)}`}
          className="text-[12px] font-medium text-accent hover:underline"
        >
          Voir les tâches
        </Link>
        {round.rawText && (
          <details className="text-[12px]">
            <summary className="cursor-pointer text-muted hover:text-ink">Collage d’origine</summary>
            <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-2 font-mono text-[11px]">{round.rawText}</pre>
          </details>
        )}
        <span className="ml-auto flex gap-2">
          {open ? (
            !closing && (
              <GhostButton type="button" onClick={() => setClosing(true)}>
                Clôturer avec la mise en ligne…
              </GhostButton>
            )
          ) : (
            <GhostButton type="button" disabled={pending} onClick={reopen}>
              Rouvrir
            </GhostButton>
          )}
        </span>
      </div>

      {open && closing && (
        <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-line bg-surface-2 p-3">
          <label className="min-w-0 flex-1 text-[12px] text-ink-2">
            Mise en ligne qui livre ce lot
            <select
              value={deliveryId}
              onChange={(event) => setDeliveryId(event.target.value)}
              className="mt-1 block w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[13px]"
            >
              {deliveries.map((delivery) => (
                <option key={delivery.id} value={delivery.id}>
                  {formatParis(delivery.deployedAt, "d MMM")} · {delivery.title}
                </option>
              ))}
              <option value="">Sans mise en ligne</option>
            </select>
          </label>
          <GhostButton type="button" onClick={() => setClosing(false)}>Annuler</GhostButton>
          <PrimaryButton type="button" disabled={pending} onClick={close}>Clôturer</PrimaryButton>
        </div>
      )}

      {open && (
        <div className="mt-3">
          <QuickAdd projectId={projectId} roundId={round.id} compact placeholder="Ajouter une tâche à ce lot…" />
        </div>
      )}
    </li>
  );
}
