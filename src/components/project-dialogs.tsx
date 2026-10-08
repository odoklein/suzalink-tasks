"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { buildRecap, createDelivery } from "@/app/actions/deliveries";
import { createProject } from "@/app/actions/projects";
import { importFeedback } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { Dialog, fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { StatusIcon } from "@/components/primitives";
import { PROJECT_COLORS, STATUS_BY_VALUE } from "@/lib/constants";
import { parseFeedbackTable } from "@/lib/feedback-import";
import { formatParis, toParisDateInput, toParisDateTimeInput } from "@/lib/time";
import { cn } from "@/lib/utils";

export function ImportDialog({ open, onClose, projectId }: { open: boolean; onClose: () => void; projectId: string }) {
  const [text, setText] = useState("");
  const [source, setSource] = useState(() => `Retours du ${formatParis(new Date(), "dd/MM")}`);
  const [pending, startTransition] = useTransition();
  const rows = useMemo(() => parseFeedbackTable(text), [text]);

  const submit = () =>
    startTransition(async () => {
      const result = await importFeedback(projectId, text, source);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.count} retours importés`);
      setText("");
      onClose();
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Importer un tableau de retours"
      description="Copiez les cellules depuis Google Sheets ou Excel (en-têtes compris) et collez-les ici. Chaque ligne devient une tâche : la colonne Page donne la zone, la colonne État donne le statut."
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="import-source" className={labelClass}>Source</label>
          <input id="import-source" value={source} onChange={(event) => setSource(event.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="import-text" className={labelClass}>Tableau collé</label>
          <textarea
            id="import-text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={6}
            placeholder={"Date\tPage\tRetour\tCommentaire\tÉtat\n05/10\tHomepage\tInsérer la vidéo dans le bloc…\t\tPas fait"}
            className={cn(fieldClass, "font-mono text-[12px]")}
          />
        </div>

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-line">
            <p className="border-b border-line bg-surface-2 px-3 py-2 text-[12px] font-medium text-ink-2">
              {rows.length} tâche{rows.length > 1 ? "s" : ""} à créer
            </p>
            <ul className="max-h-56 overflow-y-auto scroll-thin">
              {rows.map((row, index) => (
                <li key={index} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-[12px] last:border-b-0">
                  <StatusIcon status={row.status} size={13} />
                  <span className="w-20 shrink-0 truncate text-muted">{STATUS_BY_VALUE[row.status].short}</span>
                  {row.zone && <span className="max-w-[8rem] shrink-0 truncate rounded bg-sunken px-1.5 py-0.5 text-[11px]">{row.zone}</span>}
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <GhostButton type="button" onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton type="button" disabled={pending || rows.length === 0} onClick={submit}>
            {pending ? "Import…" : `Créer ${rows.length || ""} tâches`}
          </PrimaryButton>
        </div>
      </div>
    </Dialog>
  );
}

export function RecapDialog({
  open,
  onClose,
  projectId,
  lastDeliveryAt,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  lastDeliveryAt: string | null;
}) {
  const [since, setSince] = useState("");
  const [text, setText] = useState("");
  const [counts, setCounts] = useState<{ done: number; waiting: number; remaining: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const generate = (sinceValue: string) =>
    startTransition(async () => {
      const result = await buildRecap(projectId, sinceValue || undefined);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setText(result.text);
      setCounts(result.counts);
    });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copie impossible : sélectionnez le texte et copiez-le à la main.");
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Récap client"
      description="Un message prêt à envoyer : ce qui est fait, ce qui attend le client, ce qui reste chez nous. Relisez-le avant envoi."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="recap-since" className={labelClass}>Tâches faites depuis</label>
            <input id="recap-since" type="date" value={since} onChange={(event) => setSince(event.target.value)} className={cn(fieldClass, "w-auto")} />
          </div>
          {lastDeliveryAt && (
            <GhostButton type="button" onClick={() => setSince(toParisDateInput(lastDeliveryAt))}>
              Depuis la dernière mise en ligne
            </GhostButton>
          )}
          <PrimaryButton type="button" disabled={pending} onClick={() => generate(since)}>
            {pending ? "Génération…" : "Générer"}
          </PrimaryButton>
        </div>

        {text && (
          <>
            {counts && (
              <p className="text-[12px] text-muted">
                {counts.done} faites · {counts.waiting} en attente client · {counts.remaining} en cours
              </p>
            )}
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={14} aria-label="Texte du récap" className={cn(fieldClass, "text-[13px] leading-relaxed")} />
            <div className="flex justify-end">
              <PrimaryButton type="button" onClick={copy}>
                {copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />}
                {copied ? "Copié" : "Copier le texte"}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </Dialog>
  );
}

export function DeliveryDialog({
  open,
  onClose,
  projectId,
  siteUrl,
}: {
  open: boolean;
  onClose: () => void;
  projectId: string;
  siteUrl: string | null;
}) {
  // Heure de Paris, comme l'équipe : le serveur relit cette valeur en heure de Paris (voir createDelivery).
  const local = toParisDateTimeInput(new Date());
  const [pending, startTransition] = useTransition();

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Enregistrer une mise en ligne"
      description="Date et heure exactes : c'est la preuve de ce qui a été livré, et quand."
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          startTransition(async () => {
            const result = await createDelivery(projectId, {
              title: String(data.get("title") ?? ""),
              notes: String(data.get("notes") ?? ""),
              url: String(data.get("url") ?? ""),
              deployedAt: String(data.get("deployedAt") ?? ""),
            });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("Mise en ligne enregistrée");
            onClose();
          });
        }}
      >
        <div>
          <label htmlFor="delivery-title" className={labelClass}>Ce qui a été mis en ligne</label>
          <input id="delivery-title" name="title" required placeholder="Corrections du tableau de Luna" className={fieldClass} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="delivery-date" className={labelClass}>Date et heure</label>
            <input id="delivery-date" name="deployedAt" type="datetime-local" defaultValue={local} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="delivery-url" className={labelClass}>Lien</label>
            <input id="delivery-url" name="url" defaultValue={siteUrl ?? ""} placeholder="https://…" className={fieldClass} />
          </div>
        </div>
        <div>
          <label htmlFor="delivery-notes" className={labelClass}>Détail (facultatif)</label>
          <textarea id="delivery-notes" name="notes" rows={3} placeholder="Commit, pages concernées, points à vérifier…" className={fieldClass} />
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Enregistrer"}</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}

export function NewProjectDialog() {
  const { newProjectOpen, setNewProjectOpen, clients } = useApp();
  const [state, action, pending] = useActionState(createProject, undefined);
  const pathname = usePathname();

  // Une création réussie redirige vers le projet : on ferme à ce moment-là.
  useEffect(() => setNewProjectOpen(false), [pathname, setNewProjectOpen]);
  const [color, setColor] = useState(PROJECT_COLORS[5]);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");

  return (
    <Dialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} title="Nouveau projet">
      <form action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
          <div>
            <label htmlFor="project-name" className={labelClass}>Nom</label>
            <input id="project-name" name="name" required autoFocus placeholder="Bières Georges" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="project-key" className={labelClass}>Préfixe</label>
            <input id="project-key" name="key" maxLength={4} placeholder="BG" className={cn(fieldClass, "font-mono uppercase")} />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Client ou agence</legend>
          <div className="mb-2 flex gap-1 text-[12px]">
            {(["existing", "new"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={mode === "existing" && clients.length === 0}
                onClick={() => setClientMode(mode)}
                className={cn("rounded-md px-2.5 py-1 font-medium disabled:opacity-40", clientMode === mode ? "bg-sunken text-ink" : "text-muted")}
              >
                {mode === "existing" ? "Existant" : "Nouveau"}
              </button>
            ))}
          </div>
          {clientMode === "existing" ? (
            <select name="clientId" aria-label="Client" className={fieldClass} defaultValue="">
              <option value="">Aucun (projet interne)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input name="newClient" aria-label="Nom du client" placeholder="Agence 33 Degrés" className={fieldClass} />
              <select name="clientKind" aria-label="Type de client" className={cn(fieldClass, "w-auto")} defaultValue="AGENCY">
                <option value="AGENCY">Agence partenaire</option>
                <option value="DIRECT">Client direct</option>
              </select>
            </div>
          )}
        </fieldset>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="project-end" className={labelClass}>Client final</label>
            <input id="project-end" name="endClient" placeholder="Bières Georges (Julien)" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="project-due" className={labelClass}>Échéance</label>
            <input id="project-due" name="dueDate" type="date" className={fieldClass} />
          </div>
        </div>
        <div>
          <label htmlFor="project-url" className={labelClass}>Lien du site ou de la maquette</label>
          <input id="project-url" name="siteUrl" placeholder="https://bieres.netlify.app" className={fieldClass} />
        </div>

        <div>
          <span className={labelClass}>Couleur</span>
          <input type="hidden" name="color" value={color} />
          <div className="flex gap-1.5">
            {PROJECT_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Couleur ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => setColor(swatch)}
                style={{ backgroundColor: swatch }}
                className={cn("size-6 rounded-md transition-transform", color === swatch && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              />
            ))}
          </div>
        </div>

        {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton type="button" onClick={() => setNewProjectOpen(false)}>Annuler</GhostButton>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Création…" : "Créer le projet"}</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
