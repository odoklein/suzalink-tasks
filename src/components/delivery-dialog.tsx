"use client";

import type { RoundStatus } from "@prisma/client";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { createDelivery, updateDelivery } from "@/app/actions/deliveries";
import { Dialog, fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { StatusIcon } from "@/components/primitives";
import { deliveryCandidates, roundsToClose, suggestDeliveryTitle } from "@/lib/deliveries";
import { plural } from "@/lib/plural";
import { toParisDateTimeInput } from "@/lib/time";
import type { TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EditableDelivery = {
  id: string;
  title: string;
  notes: string | null;
  url: string | null;
  deployedAt: Date;
  taskIds: string[];
};

/**
 * Enregistrer (ou modifier) une mise en ligne avec son contenu : tâches
 * livrées, « À valider » à passer en Fait, lots de retours à clôturer.
 * Monté seulement quand la fenêtre est ouverte.
 */
export function DeliveryDialog({
  onClose,
  onSaved,
  projectId,
  projectKey,
  siteUrl,
  tasks,
  rounds,
  previousDeliveryAt,
  editing,
}: {
  onClose: () => void;
  onSaved?: (deliveryId: string) => void;
  projectId: string;
  projectKey: string;
  siteUrl: string | null;
  tasks: TaskCard[];
  rounds: { id: string; label: string; status: RoundStatus }[];
  previousDeliveryAt: Date | null;
  editing?: EditableDelivery;
}) {
  const [pending, startTransition] = useTransition();

  // Tâches proposées : « À valider » et « Fait » depuis la mise en ligne précédente (+ celles déjà liées en modification).
  const candidates = useMemo(() => {
    const base = deliveryCandidates(tasks, editing ? null : previousDeliveryAt);
    if (!editing) return base;
    const linked = new Set(editing.taskIds);
    return tasks.filter((task) => linked.has(task.id) || base.includes(task));
  }, [tasks, previousDeliveryAt, editing]);

  const [included, setIncluded] = useState<Set<string>>(
    () => new Set(editing ? editing.taskIds : candidates.map((task) => task.id)),
  );
  const [promote, setPromote] = useState(false);
  const reviewIncluded = candidates.filter((task) => task.status === "REVIEW" && included.has(task.id));
  const promotedIds = new Set(promote ? reviewIncluded.map((task) => task.id) : []);
  const roundOptions = editing ? [] : roundsToClose(rounds, tasks, promotedIds);
  const [roundChoice, setRoundChoice] = useState<Record<string, boolean>>({});
  const closeRound = (id: string, complete: boolean) => roundChoice[id] ?? complete;

  const suggested = suggestDeliveryTitle(candidates.filter((task) => included.has(task.id)).map((task) => task.zone));
  const [title, setTitle] = useState<string | null>(editing?.title ?? null);
  const [deployedAt, setDeployedAt] = useState(() => toParisDateTimeInput(editing?.deployedAt ?? new Date()));
  const [url, setUrl] = useState(editing?.url ?? siteUrl ?? "");
  const [notes, setNotes] = useState(editing?.notes ?? "");

  const toggle = (id: string) =>
    setIncluded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const allIncluded = candidates.length > 0 && candidates.every((task) => included.has(task.id));

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const input = {
      title: title ?? suggested,
      notes,
      url,
      deployedAt,
      taskIds: [...included],
      promoteIds: [...promotedIds],
      closeRoundIds: roundOptions.filter((round) => closeRound(round.id, round.complete)).map((round) => round.id),
    };
    startTransition(async () => {
      const result = editing ? await updateDelivery(editing.id, input) : await createDelivery(projectId, input);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      if (!editing && "id" in result && result.id) onSaved?.(result.id);
      else toast.success("Mise en ligne modifiée");
      onClose();
    });
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={editing ? "Modifier la mise en ligne" : "Enregistrer une mise en ligne"}
      description="Date et heure exactes, et ce qui a été livré : c’est la preuve de ce qui a été mis en ligne, et quand."
    >
      <form className="space-y-3" onSubmit={submit}>
        <div>
          <label htmlFor="delivery-title" className={labelClass}>Ce qui a été mis en ligne</label>
          <input
            id="delivery-title"
            required
            value={title ?? suggested}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="delivery-date" className={labelClass}>Date et heure (heure de Paris)</label>
            <input
              id="delivery-date"
              type="datetime-local"
              value={deployedAt}
              onChange={(event) => setDeployedAt(event.target.value)}
              className={fieldClass}
            />
          </div>
          <div>
            <label htmlFor="delivery-url" className={labelClass}>Lien</label>
            <input id="delivery-url" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://…" className={fieldClass} />
          </div>
        </div>

        {candidates.length > 0 && (
          <fieldset className="overflow-hidden rounded-lg border border-line">
            <legend className="sr-only">Tâches livrées</legend>
            <label className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2 text-[12px] font-medium text-ink-2">
              <input
                type="checkbox"
                checked={allIncluded}
                onChange={() => setIncluded(allIncluded ? new Set() : new Set(candidates.map((task) => task.id)))}
                className="accent-[var(--accent)]"
              />
              Inclure {plural(candidates.length, "tâche")}
              <span className="ml-auto font-normal text-muted">{included.size} cochée{included.size > 1 ? "s" : ""}</span>
            </label>
            <ul className="max-h-48 overflow-y-auto scroll-thin">
              {candidates.map((task) => (
                <li key={task.id}>
                  <label className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[12px] last:border-b-0">
                    <input type="checkbox" checked={included.has(task.id)} onChange={() => toggle(task.id)} className="accent-[var(--accent)]" />
                    <StatusIcon status={task.status} size={13} />
                    <span className="font-mono text-[11px] text-muted">{projectKey}-{task.number}</span>
                    {task.zone && <span className="max-w-[8rem] shrink-0 truncate rounded bg-sunken px-1.5 py-0.5 text-[11px]">{task.zone}</span>}
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {reviewIncluded.length > 0 && (
          <label className="flex items-center gap-2 text-[13px] text-ink-2">
            <input type="checkbox" checked={promote} onChange={(event) => setPromote(event.target.checked)} className="accent-[var(--accent)]" />
            Passer {reviewIncluded.length > 1 ? `les ${reviewIncluded.length}` : "la"} “À valider” en Fait
          </label>
        )}

        {roundOptions.length > 0 && (
          <fieldset className="space-y-1">
            <legend className={labelClass}>Lots de retours</legend>
            {roundOptions.map((option) => {
              const round = rounds.find((r) => r.id === option.id);
              return (
                <label key={option.id} className="flex items-center gap-2 text-[13px] text-ink-2">
                  <input
                    type="checkbox"
                    checked={closeRound(option.id, option.complete)}
                    onChange={(event) => setRoundChoice((current) => ({ ...current, [option.id]: event.target.checked }))}
                    className="accent-[var(--accent)]"
                  />
                  Clôturer «&#8239;{round?.label}&#8239;»
                  {!option.complete && <span className="text-[12px] text-muted">(des tâches restent ouvertes)</span>}
                </label>
              );
            })}
          </fieldset>
        )}

        <div>
          <label htmlFor="delivery-notes" className={labelClass}>Détail (facultatif)</label>
          <textarea
            id="delivery-notes"
            rows={3}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Commit, pages concernées, points à vérifier…"
            className={cn(fieldClass)}
          />
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
