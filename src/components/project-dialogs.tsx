"use client";

import { Check, ClipboardCopy } from "lucide-react";
import { usePathname } from "next/navigation";
import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { buildRecap, createDelivery } from "@/app/actions/deliveries";
import { createProject } from "@/app/actions/projects";
import { importFeedback } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { Dialog, fieldClass, labelClass } from "@/components/dialog";
import { StatusIcon } from "@/components/primitives";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PROJECT_COLORS, STATUS_BY_VALUE } from "@/lib/constants";
import { parseFeedbackTable } from "@/lib/feedback-import";
import { plural } from "@/lib/plural";
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
      toast.success(plural(result.count, "retour importé", "retours importés"));
      setText("");
      onClose();
    });

  return (
    <Dialog
      open={open}
      onClose={onClose}
      wide
      title="Importer un tableau de retours"
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" loading={pending} disabled={rows.length === 0} onClick={submit}>
            {pending ? "Import…" : `Créer ${rows.length || ""} tâches`}
          </Button>
        </>
      }
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
            className={cn(fieldClass, "font-mono text-xs")}
          />
        </div>

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-md border border-line">
            <p className="border-b border-line bg-surface-2 px-3 py-2 text-xs font-medium text-ink-2">
              {plural(rows.length, "tâche")} à créer
            </p>
            <ul className="max-h-56 overflow-y-auto scroll-thin">
              {rows.map((row, index) => (
                <li key={index} className="flex items-center gap-2 border-b border-line px-3 py-1.5 text-xs last:border-b-0">
                  <StatusIcon status={row.status} size={13} />
                  <span className="w-20 shrink-0 truncate text-muted">{STATUS_BY_VALUE[row.status].short}</span>
                  {row.zone && <span className="max-w-[8rem] shrink-0 truncate rounded-xs bg-sunken px-1.5 py-0.5 text-meta">{row.zone}</span>}
                  <span className="min-w-0 flex-1 truncate">{row.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
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
      footer={
        text ? (
          <Button variant="primary" icon={copied ? <Check className="size-4" /> : <ClipboardCopy className="size-4" />} onClick={copy}>
            {copied ? "Copié" : "Copier le texte"}
          </Button>
        ) : undefined
      }
      description="Un message prêt à envoyer : ce qui est fait, ce qui attend le client, ce qui reste chez nous. Relisez-le avant envoi."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label htmlFor="recap-since" className={labelClass}>Tâches faites depuis</label>
            <DatePicker id="recap-since" label="Tâches faites depuis" value={since || null} onChange={(value) => setSince(value ?? "")} className="w-44" />
          </div>
          {lastDeliveryAt && (
            <Button onClick={() => setSince(toParisDateInput(lastDeliveryAt))}>
              Depuis la dernière mise en ligne
            </Button>
          )}
          <Button variant="primary" loading={pending} onClick={() => generate(since)}>
            {pending ? "Génération…" : "Générer"}
          </Button>
        </div>

        {text && (
          <>
            {counts && (
              <p className="text-xs text-muted">
                {plural(counts.done, "faite")} · {counts.waiting} chez le client · {counts.remaining} en cours
              </p>
            )}
            <textarea value={text} onChange={(event) => setText(event.target.value)} rows={14} aria-label="Texte du récap" className={cn(fieldClass, "text-ui leading-relaxed")} />
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
      footer={
        <>
          <Button onClick={onClose}>Annuler</Button>
          <Button variant="primary" type="submit" form="delivery-form" loading={pending}>
            {pending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form
        id="delivery-form"
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
          <input id="delivery-title" name="title" required maxLength={180} placeholder="Corrections du tableau de Luna" className={fieldClass} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="delivery-date" className={labelClass}>Date et heure</label>
            <input id="delivery-date" name="deployedAt" type="datetime-local" defaultValue={local} className={fieldClass} />
          </div>
          <div>
            <label htmlFor="delivery-url" className={labelClass}>Lien</label>
            <input id="delivery-url" name="url" type="url" defaultValue={siteUrl ?? ""} placeholder="https://…" className={fieldClass} />
          </div>
        </div>
        <div>
          <label htmlFor="delivery-notes" className={labelClass}>Détail (facultatif)</label>
          <textarea id="delivery-notes" name="notes" rows={3} placeholder="Commit, pages concernées, points à vérifier…" className={fieldClass} />
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
  const [due, setDue] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");

  return (
    <Dialog
      open={newProjectOpen}
      onClose={() => setNewProjectOpen(false)}
      title="Nouveau projet"
      footer={
        <>
          <Button onClick={() => setNewProjectOpen(false)}>Annuler</Button>
          <Button variant="primary" type="submit" form="new-project-form" loading={pending}>
            {pending ? "Création…" : "Créer le projet"}
          </Button>
        </>
      }
    >
      <form id="new-project-form" action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
          <div>
            <label htmlFor="project-name" className={labelClass}>Nom</label>
            <input id="project-name" name="name" required autoFocus placeholder="Bières Georges" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="project-key" className={labelClass}>Préfixe</label>
            <input
              id="project-key"
              name="key"
              maxLength={4}
              pattern="[A-Za-z0-9]{1,4}"
              title="1 à 4 lettres ou chiffres"
              placeholder="BG"
              className={cn(fieldClass, "font-mono uppercase")}
            />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Client ou agence</legend>
          <SegmentedControl
            className="mb-2"
            label="Type de saisie du client"
            value={clientMode}
            onChange={setClientMode}
            options={clients.length ? [{ value: "existing", label: "Existant" }, { value: "new", label: "Nouveau" }] : [{ value: "new", label: "Nouveau" }]}
          />
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
            <DatePicker id="project-due" name="dueDate" label="Échéance" value={due} onChange={setDue} />
          </div>
        </div>
        <div>
          <label htmlFor="project-url" className={labelClass}>Lien du site ou de la maquette</label>
          <input id="project-url" name="siteUrl" type="url" placeholder="https://bieres.netlify.app" className={fieldClass} />
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
                className={cn("size-6 rounded-sm transition-transform", color === swatch && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              />
            ))}
          </div>
        </div>

        {state?.error && <p className="text-ui text-danger-text">{state.error}</p>}
      </form>
    </Dialog>
  );
}
