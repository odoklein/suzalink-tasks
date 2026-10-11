"use client";

import type { ProposalBasis, ProposalStatus } from "@prisma/client";
import { Check, Link2, Undo2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { useApp } from "@/components/app-context";
import { compactFieldClass } from "@/components/dialog";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { Avatar, EmptyAvatar } from "@/components/primitives";
import { SelectMenu } from "@/components/select-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { quote } from "@/lib/fr";
import { BASIS_LABELS, formatOffset } from "@/lib/meetings/labels";
import { plural } from "@/lib/plural";
import { toParisDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";

export type ProposalItem = {
  id: string;
  title: string;
  description: string | null;
  basis: ProposalBasis;
  quote: string;
  /** Passages de transcription cités (réunions seulement). */
  segmentIndexes?: number[];
  ownerText: string | null;
  suggestedUserId: string | null;
  dueText: string | null;
  suggestedDue: Date | null;
  zone: string | null;
  status: ProposalStatus;
  task: { ref: string; title: string } | null;
  duplicate: { ref: string; title: string } | null;
};

type Segment = { index: number; speaker: string | null; startMs: number };

type Outcome<T extends object = object> = ({ ok: true } & T) | { ok?: false; error: string };
export type AcceptItem = { proposalId: string; title: string; assigneeId: string | null; dueDate: string | null; zone: string | null };

/** Server Actions déjà liées à la réunion ou à l'e-mail (`.bind(null, id)`). */
export type ProposalActions = {
  accept: (items: AcceptItem[]) => Promise<Outcome<{ refs: string[] }>>;
  link: (proposalId: string, ref: string) => Promise<Outcome<{ ref: string }>>;
  ignore: (proposalId: string, ignored: boolean) => Promise<Outcome>;
};

type Draft = { title: string; assigneeId: string | null; dueDate: string; zone: string | null };

const NOBODY = "__personne__";
const NO_ZONE = "__aucune__";

/**
 * Actions proposées (compte rendu de réunion, e-mail client) : chacune est
 * modifiable, puis créée (dans le lot de la réunion ou de l'e-mail), rattachée
 * à une tâche existante ou ignorée.
 */
export function ProposalReview({
  actions,
  hasProject,
  proposals,
  segments = [],
  zones,
  noProjectHint = "Associez d’abord la réunion à un projet pour créer les tâches.",
}: {
  actions: ProposalActions;
  hasProject: boolean;
  proposals: ProposalItem[];
  /** Passages de transcription, pour relier chaque citation à son moment (réunions seulement). */
  segments?: Segment[];
  zones: string[];
  noProjectHint?: string;
}) {
  const pending = proposals.filter((proposal) => proposal.status === "PENDING");
  const done = proposals.filter((proposal) => proposal.status !== "PENDING");
  const { pending: busy, run } = useMeetingAction();

  // Par défaut : ce qui est demandé ou promis ; ce qui est seulement déduit reste à cocher.
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(pending.filter((proposal) => proposal.basis !== "INFERRED").map((proposal) => proposal.id)),
  );
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      pending.map((proposal) => [
        proposal.id,
        {
          title: proposal.title,
          assigneeId: proposal.suggestedUserId,
          dueDate: proposal.suggestedDue ? toParisDateInput(proposal.suggestedDue) : "",
          zone: proposal.zone,
        },
      ]),
    ),
  );
  const segmentByIndex = new Map(segments.map((segment) => [segment.index, segment]));

  const chosen = pending.filter((proposal) => selected.has(proposal.id));
  const toggle = (id: string, on: boolean) =>
    setSelected((current) => {
      const next = new Set(current);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const update = (id: string, patch: Partial<Draft>) => setDrafts((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const createSelected = () =>
    run(
      () =>
        actions.accept(
          chosen.map((proposal) => {
            const draft = drafts[proposal.id];
            return { proposalId: proposal.id, title: draft.title, assigneeId: draft.assigneeId, dueDate: draft.dueDate || null, zone: draft.zone };
          }),
        ),
      (result) => `${plural(result.refs.length, "tâche créée", "tâches créées")} : ${result.refs.join(", ")}`,
    );

  if (proposals.length === 0) {
    return <p className="text-ui text-muted">Aucune action à faire n’est ressortie de cette réunion.</p>;
  }

  return (
    <div>
      {pending.length > 0 && (
        <ul className="space-y-3">
          {pending.map((proposal) => (
            <PendingCard
              key={proposal.id}
              actions={actions}
              proposal={proposal}
              draft={drafts[proposal.id]}
              selected={selected.has(proposal.id)}
              onToggle={(on) => toggle(proposal.id, on)}
              onChange={(patch) => update(proposal.id, patch)}
              segment={proposal.segmentIndexes?.length ? segmentByIndex.get(proposal.segmentIndexes[0]) : undefined}
              zones={zones}
              disabled={busy}
            />
          ))}
        </ul>
      )}

      {pending.length > 0 && (
        <div className="sticky bottom-0 z-sticky -mx-1 mt-4 flex flex-wrap items-center justify-end gap-x-4 gap-y-2 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur">
          <p className="mr-auto text-ui text-muted">
            {hasProject ? plural(chosen.length, "action choisie", "actions choisies") : noProjectHint}
          </p>
          <Button variant="primary" onClick={createSelected} loading={busy} disabled={!hasProject || chosen.length === 0}>
            {chosen.length > 1 ? `Créer les ${chosen.length} tâches` : "Créer la tâche"}
          </Button>
        </div>
      )}

      {done.length > 0 && (
        <div className={cn(pending.length > 0 && "mt-6")}>
          <h3 className="mb-1.5 text-xs font-semibold text-muted">Traitées</h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {done.map((proposal) => (
              <DoneRow key={proposal.id} actions={actions} proposal={proposal} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PendingCard({
  actions,
  proposal,
  draft,
  selected,
  onToggle,
  onChange,
  segment,
  zones,
  disabled,
}: {
  actions: ProposalActions;
  proposal: ProposalItem;
  draft: Draft;
  selected: boolean;
  onToggle: (on: boolean) => void;
  onChange: (patch: Partial<Draft>) => void;
  segment: Segment | undefined;
  zones: string[];
  disabled: boolean;
}) {
  const { team } = useApp();
  const { pending, run } = useMeetingAction();
  const [linking, setLinking] = useState(false);
  const [ref, setRef] = useState(proposal.duplicate?.ref ?? "");
  const basis = BASIS_LABELS[proposal.basis];
  const assignee = team.find((member) => member.id === draft.assigneeId) ?? null;
  const titleId = `proposition-${proposal.id}`;

  const link = (target: string) =>
    run(() => actions.link(proposal.id, target), (result) => `Rattachée à ${result.ref}`);

  return (
    <li className={cn("rounded-xl border bg-surface p-4 shadow-card transition-colors", selected ? "border-accent/50" : "border-line")}>
      <div className="flex gap-3">
        <Checkbox
          checked={selected}
          onChange={(event) => onToggle(event.target.checked)}
          aria-labelledby={titleId}
          className="mt-2 self-start"
        />
        <div className="min-w-0 flex-1 space-y-2.5">
          <span id={titleId} className="sr-only">
            Créer la tâche {quote(draft.title)}
          </span>
          <Input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} aria-label="Titre de la tâche" maxLength={500} />

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <Badge tone={basis.tone}>{basis.label}</Badge>

            <span className="inline-flex items-center gap-1">
              <SelectMenu<string>
                label="Attribuer à"
                searchable
                value={draft.assigneeId ?? NOBODY}
                onChange={(value) => onChange({ assigneeId: value === NOBODY ? null : value })}
                options={[{ value: NOBODY, label: "Personne" }, ...team.map((member) => ({ value: member.id, label: member.name, icon: <Avatar name={member.name} color={member.color} size={16} /> }))]}
                trigger={
                  assignee ? (
                    <>
                      <Avatar name={assignee.name} color={assignee.color} size={18} />
                      <span>{assignee.name}</span>
                    </>
                  ) : (
                    <>
                      <EmptyAvatar size={18} />
                      <span className="text-muted">Attribuer</span>
                    </>
                  )
                }
              />
              {proposal.ownerText && <span className="text-meta text-muted">dit{NNBSP_COLON} {proposal.ownerText}</span>}
            </span>

            <span className="inline-flex items-center gap-1.5">
              <label htmlFor={`echeance-${proposal.id}`} className="text-meta text-muted">
                Échéance
              </label>
              <input
                id={`echeance-${proposal.id}`}
                type="date"
                value={draft.dueDate}
                onChange={(event) => onChange({ dueDate: event.target.value })}
                className={cn(compactFieldClass, "tabular")}
              />
              {proposal.dueText && <span className="text-meta text-muted">dit{NNBSP_COLON} {proposal.dueText}</span>}
            </span>

            {zones.length > 0 && (
              <SelectMenu<string>
                label="Page"
                value={draft.zone ?? NO_ZONE}
                onChange={(value) => onChange({ zone: value === NO_ZONE ? null : value })}
                options={[{ value: NO_ZONE, label: "Aucune page" }, ...zones.map((zone) => ({ value: zone, label: zone }))]}
                trigger={<span className={draft.zone ? "text-ink-2" : "text-muted"}>{draft.zone ?? "Page"}</span>}
              />
            )}
          </div>

          {proposal.description && <p className="text-ui text-ink-2">{proposal.description}</p>}

          <blockquote className="border-l-2 border-line-strong pl-3 text-ui text-ink-2">
            {quote(proposal.quote)}
            {segment && (
              <>
                {" "}
                <a href={`#s-${segment.index}`} className="whitespace-nowrap text-meta text-muted hover:text-ink hover:underline">
                  {formatOffset(segment.startMs)}
                  {segment.speaker ? ` · ${segment.speaker}` : ""}
                </a>
              </>
            )}
          </blockquote>

          {proposal.duplicate && !linking && (
            <p className="flex flex-wrap items-center gap-2 text-ui text-waiting-text">
              Peut-être déjà {proposal.duplicate.ref} {quote(proposal.duplicate.title)}
              <Button size="sm" icon={<Link2 className="size-3.5" />} onClick={() => link(proposal.duplicate!.ref)} loading={pending} disabled={disabled}>
                Rattacher à {proposal.duplicate.ref}
              </Button>
            </p>
          )}

          {linking && (
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (ref.trim()) link(ref.trim());
              }}
            >
              <label htmlFor={`ref-${proposal.id}`} className="text-ui text-ink-2">
                Rattacher à la tâche
              </label>
              <input
                id={`ref-${proposal.id}`}
                value={ref}
                onChange={(event) => setRef(event.target.value)}
                placeholder="BG-12"
                autoFocus
                className={cn(compactFieldClass, "w-28 font-mono uppercase")}
              />
              <Button type="submit" size="sm" loading={pending} disabled={!ref.trim() || disabled}>
                Rattacher
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setLinking(false)}>
                Annuler
              </Button>
            </form>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-1">
          <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => run(() => actions.ignore(proposal.id, true))} disabled={pending || disabled}>
            Ignorer
          </Button>
          {!linking && (
            <Button size="sm" variant="ghost" icon={<Link2 className="size-3.5" />} onClick={() => setLinking(true)} disabled={pending || disabled}>
              Rattacher…
            </Button>
          )}
        </div>
      </div>
    </li>
  );
}

/** Espace fine insécable + deux-points, pour « dit : jeudi ». */
const NNBSP_COLON = " :";

function DoneRow({ actions, proposal }: { actions: ProposalActions; proposal: ProposalItem }) {
  const { pending, run } = useMeetingAction();
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-ui">
      {proposal.status === "REJECTED" ? (
        <X className="size-4 shrink-0 text-faint" aria-hidden="true" />
      ) : (
        <Check className="size-4 shrink-0 text-done-text" aria-hidden="true" />
      )}
      <span className={cn("min-w-0 flex-1 truncate", proposal.status === "REJECTED" && "text-muted line-through")}>{proposal.title}</span>
      {proposal.status === "ACCEPTED" && proposal.task && (
        <Link href={`?tache=${proposal.task.ref}`} scroll={false} className="font-mono text-meta font-medium text-accent hover:underline">
          {proposal.task.ref} créée
        </Link>
      )}
      {proposal.status === "LINKED" && proposal.task && (
        <Link href={`?tache=${proposal.task.ref}`} scroll={false} className="font-mono text-meta font-medium text-accent hover:underline">
          Rattachée à {proposal.task.ref}
        </Link>
      )}
      {proposal.status === "REJECTED" && (
        <Button size="sm" variant="ghost" icon={<Undo2 className="size-3.5" />} onClick={() => run(() => actions.ignore(proposal.id, false))} loading={pending}>
          Remettre
        </Button>
      )}
    </li>
  );
}
