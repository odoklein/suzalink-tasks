"use client";

import type { ExtraStatus } from "@prisma/client";
import { ClipboardCopy, Mail, Plus } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { createExtra, getQuoteDraft, logQuoteSent, setExtraStatus, updateExtra } from "@/app/actions/extras";
import { Dialog, fieldClass, GhostButton, PrimaryButton } from "@/components/dialog";
import { mailtoLink } from "@/lib/chasing";
import { EXTRA_STATUS_LABELS, formatEuros, parseEuros } from "@/lib/extras";
import { plural } from "@/lib/plural";
import { formatParis } from "@/lib/time";
import type { TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ExtraData = {
  id: string;
  number: number;
  title: string;
  amountCents: number | null;
  status: ExtraStatus;
  quotedAt: Date | null;
  approvedAt: Date | null;
  approvedBy: string | null;
  invoicedAt: Date | null;
  invoiceRef: string | null;
  paidAt: Date | null;
};

/** Onglet « Avenants » : hors périmètre à regrouper, puis cycle devis → accord → facture. */
export function ExtrasView({
  projectId,
  projectKey,
  extras,
  tasks,
}: {
  projectId: string;
  projectKey: string;
  extras: ExtraData[];
  tasks: TaskCard[];
}) {
  const loose = tasks.filter((task) => task.billable && !task.extraId);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [title, setTitle] = useState("");
  const [pending, startTransition] = useTransition();

  const create = () =>
    startTransition(async () => {
      const result = await createExtra(projectId, { title, taskIds: [...selected] });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`Avenant AV-${result.number} créé`);
      setSelected(new Set());
      setTitle("");
    });

  const selectedTotal = loose
    .filter((task) => selected.has(task.id) && task.estimatedAmountCents !== null)
    .reduce((sum, task) => sum + (task.estimatedAmountCents ?? 0), 0);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-5 px-6 pb-10">
      <section className="rounded-xl border border-line bg-surface p-4 shadow-card">
        <h2 className="text-[15px] font-semibold">Hors périmètre à regrouper</h2>
        {loose.length === 0 ? (
          <p className="mt-1 text-[13px] text-muted">
            Aucune tâche hors périmètre en attente. Ajoutez « $ » (ou « $150 ») dans la saisie rapide, ou cochez « Hors périmètre » dans une tâche.
          </p>
        ) : (
          <>
            <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
              {loose.map((task) => (
                <li key={task.id}>
                  <label className="flex items-center gap-2 px-3 py-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      checked={selected.has(task.id)}
                      onChange={() =>
                        setSelected((current) => {
                          const next = new Set(current);
                          if (next.has(task.id)) next.delete(task.id);
                          else next.add(task.id);
                          return next;
                        })
                      }
                      className="accent-[var(--accent)]"
                    />
                    <span className="font-mono text-[11px] text-muted">{projectKey}-{task.number}</span>
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <span className="tabular text-[12px] text-muted">
                      {task.estimatedAmountCents !== null ? formatEuros(task.estimatedAmountCents) : "à chiffrer"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Intitulé de l’avenant (ex. Bannières de Noël)"
                aria-label="Intitulé de l’avenant"
                className={cn(fieldClass, "min-w-0 flex-1")}
              />
              <PrimaryButton type="button" disabled={pending || selected.size === 0 || !title.trim()} onClick={create}>
                <Plus className="size-4" /> Créer un avenant
                {selected.size > 0 && ` · ${plural(selected.size, "tâche")}${selectedTotal ? ` · ${formatEuros(selectedTotal)}` : ""}`}
              </PrimaryButton>
            </div>
          </>
        )}
      </section>

      {extras.length > 0 && (
        <ul className="space-y-3">
          {extras.map((extra) => (
            <ExtraCard key={extra.id} extra={extra} projectKey={projectKey} tasks={tasks.filter((task) => task.extraId === extra.id)} />
          ))}
        </ul>
      )}
    </div>
  );
}

function ExtraCard({ extra, projectKey, tasks }: { extra: ExtraData; projectKey: string; tasks: TaskCard[] }) {
  const [pending, startTransition] = useTransition();
  const [quoting, setQuoting] = useState(false);
  const [detail, setDetail] = useState("");
  const [amount, setAmount] = useState(extra.amountCents !== null ? String(extra.amountCents / 100).replace(".", ",") : "");

  const move = (to: ExtraStatus, details: { approvedBy?: string; invoiceRef?: string } = {}) =>
    startTransition(async () => {
      const result = await setExtraStatus(extra.id, to, details);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`AV-${extra.number} : ${EXTRA_STATUS_LABELS[to].toLowerCase()}`);
      setDetail("");
    });

  const saveAmount = () => {
    const cents = parseEuros(amount);
    if (amount.trim() && cents === null) {
      toast.error("Montant illisible : écrivez par exemple 450 ou 450,50.");
      return;
    }
    if (cents === extra.amountCents) return;
    startTransition(async () => {
      await updateExtra(extra.id, { amountCents: cents });
    });
  };

  const dates = [
    extra.quotedAt && `devis le ${formatParis(extra.quotedAt, "dd/MM")}`,
    extra.approvedAt && `accepté le ${formatParis(extra.approvedAt, "dd/MM")}${extra.approvedBy ? ` par ${extra.approvedBy}` : ""}`,
    extra.invoicedAt && `facturé le ${formatParis(extra.invoicedAt, "dd/MM")}${extra.invoiceRef ? ` (${extra.invoiceRef})` : ""}`,
    extra.paidAt && `payé le ${formatParis(extra.paidAt, "dd/MM")}`,
  ].filter(Boolean);

  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="font-mono text-[12px] text-muted">AV-{extra.number}</span>
        <h3 className="text-[15px] font-semibold">{extra.title}</h3>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2">{EXTRA_STATUS_LABELS[extra.status]}</span>
        <span className="tabular ml-auto text-[14px] font-semibold">{extra.amountCents !== null ? `${formatEuros(extra.amountCents)} HT` : "à chiffrer"}</span>
      </div>
      {dates.length > 0 && <p className="mt-1 text-[12px] text-muted">{dates.join(" · ")}</p>}
      <ul className="mt-2 space-y-0.5 text-[12px] text-ink-2">
        {tasks.map((task) => (
          <li key={task.id} className="flex gap-2">
            <span className="font-mono text-[11px] text-muted">{projectKey}-{task.number}</span>
            <span className="min-w-0 flex-1 truncate">{task.title}</span>
            {task.estimatedAmountCents !== null && <span className="tabular text-muted">{formatEuros(task.estimatedAmountCents)}</span>}
          </li>
        ))}
      </ul>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {extra.status === "DRAFT" && (
          <>
            <label className="flex items-center gap-1.5 text-[12px] text-muted">
              Montant HT
              <input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                onBlur={saveAmount}
                inputMode="decimal"
                className="w-24 rounded-md border border-line bg-surface-2 px-2 py-1 text-[13px] text-ink"
              />
              €
            </label>
            <PrimaryButton type="button" className="ml-auto" disabled={pending} onClick={() => setQuoting(true)}>
              Envoyer le devis
            </PrimaryButton>
          </>
        )}
        {extra.status === "QUOTED" && (
          <>
            <input
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Accepté par (nom)"
              aria-label="Accepté par"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[13px]"
            />
            <GhostButton type="button" disabled={pending} onClick={() => move("REJECTED")}>Refusé</GhostButton>
            <PrimaryButton type="button" disabled={pending} onClick={() => move("APPROVED", { approvedBy: detail })}>Accepté</PrimaryButton>
          </>
        )}
        {extra.status === "APPROVED" && (
          <>
            <input
              value={detail}
              onChange={(event) => setDetail(event.target.value)}
              placeholder="Référence de la facture (outil comptable)"
              aria-label="Référence de la facture"
              className="min-w-0 flex-1 rounded-md border border-line bg-surface-2 px-2 py-1 text-[13px]"
            />
            <PrimaryButton type="button" disabled={pending} onClick={() => move("INVOICED", { invoiceRef: detail })}>Facturé</PrimaryButton>
          </>
        )}
        {extra.status === "INVOICED" && (
          <PrimaryButton type="button" className="ml-auto" disabled={pending} onClick={() => move("PAID")}>Payé</PrimaryButton>
        )}
        {extra.status === "REJECTED" && (
          <GhostButton type="button" className="ml-auto" disabled={pending} onClick={() => move("DRAFT")}>Repasser en brouillon</GhostButton>
        )}
      </div>
      {quoting && <QuoteDialog extraId={extra.id} label={`AV-${extra.number}`} onClose={() => setQuoting(false)} />}
    </li>
  );
}

function QuoteDialog({ extraId, label, onClose }: { extraId: string; label: string; onClose: () => void }) {
  const [draft, setDraft] = useState<{ subject: string; body: string; to: { id: string; email: string | null } | null } | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getQuoteDraft(extraId).then((result) => {
      if (cancelled) return;
      if ("error" in result) {
        setError(result.error ?? "Erreur inconnue");
        return;
      }
      setDraft(result);
      setBody(result.body);
    });
    return () => {
      cancelled = true;
    };
  }, [extraId]);

  const record = (via: "EMAIL" | "WEB") =>
    startTransition(async () => {
      const result = await logQuoteSent(extraId, { body, toId: draft?.to?.id ?? null, via });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${label} : devis envoyé`);
      onClose();
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      toast.error("Copie impossible : sélectionnez le texte et copiez-le à la main.");
      return;
    }
    record("WEB");
  };

  const openMail = () => {
    if (!draft) return;
    const link = mailtoLink(draft.to?.email, draft.subject, body);
    if (!link) {
      void copy();
      return;
    }
    window.location.href = link;
    record("EMAIL");
  };

  return (
    <Dialog open onClose={onClose} wide title={`Devis de l’avenant ${label}`} description="Copier ou ouvrir dans la messagerie enregistre l’envoi du devis.">
      {error ? (
        <p role="alert" className="text-[13px] text-danger">{error}</p>
      ) : !draft ? (
        <p className="text-[13px] text-muted" aria-busy="true">Préparation du devis…</p>
      ) : (
        <div className="space-y-3">
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={14} aria-label="Texte du devis" className={cn(fieldClass, "text-[13px] leading-relaxed")} />
          <div className="flex justify-end gap-2">
            <GhostButton type="button" disabled={pending} onClick={copy}>
              <ClipboardCopy className="size-4" /> Copier
            </GhostButton>
            <PrimaryButton type="button" disabled={pending} onClick={openMail}>
              <Mail className="size-4" /> Ouvrir dans la messagerie
            </PrimaryButton>
          </div>
        </div>
      )}
    </Dialog>
  );
}
