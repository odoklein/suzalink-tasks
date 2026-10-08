"use client";

import type { Priority, TaskStatus } from "@prisma/client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { importFeedback, previewImport } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { Dialog, fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { StatusIcon } from "@/components/primitives";
import { PRIORITIES, TASK_STATUSES } from "@/lib/constants";
import {
  columnLetter,
  detectTable,
  parseFeedbackRows,
  parseSheetDate,
  type ColumnMapping,
} from "@/lib/feedback-import";
import {
  classificationLabel,
  classifyRows,
  countModes,
  defaultMode,
  importButtonLabel,
  modesFor,
  type ExistingMatch,
  type ImportMode,
  type RowClassification,
} from "@/lib/import-plan";
import { formatParis } from "@/lib/time";
import { cn } from "@/lib/utils";

type RowEdit = { mode?: ImportMode; zone?: string; status?: TaskStatus };

const MODE_LABELS: Record<ImportMode, string> = {
  create: "Créer",
  update: "Mettre à jour l’état",
  skip: "Ignorer",
  force: "Créer quand même",
};

const NONE = "-1";

/**
 * Import d’un tableau de retours : aperçu modifiable, détection des lignes déjà
 * importées (clé de déduplication) et des changements d’état. Monté seulement
 * quand la fenêtre est ouverte : son état repart de zéro à chaque ouverture.
 */
export function ImportDialog({
  onClose,
  projectId,
  initialText = "",
}: {
  onClose: () => void;
  projectId: string;
  initialText?: string;
}) {
  const { team } = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  const [text, setText] = useState(initialText);
  const [mappingOverride, setMappingOverride] = useState<ColumnMapping | null>(null);
  const [edits, setEdits] = useState<Record<number, RowEdit>>({});
  const [sourceInput, setSourceInput] = useState<string | null>(null);
  const [assigneeId, setAssigneeId] = useState("");
  const [priority, setPriority] = useState<Priority>("NONE");
  const [dueDate, setDueDate] = useState("");

  const detected = useMemo(() => detectTable(text), [text]);
  const mapping = mappingOverride ?? detected.mapping;
  const rows = useMemo(() => parseFeedbackRows(detected.rows, mapping), [detected, mapping]);

  // Correspondances avec les tâches existantes : calculées côté serveur (clé sha1), après une courte pause de frappe.
  const signature = useMemo(() => JSON.stringify([text, mapping]), [text, mapping]);
  const [matches, setMatches] = useState<{ signature: string; items: { key: string; match: ExistingMatch | null }[] } | null>(null);
  useEffect(() => {
    if (rows.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const result = await previewImport(projectId, text, mapping);
        if (!cancelled && "items" in result) setMatches({ signature, items: result.items });
      } catch {
        if (!cancelled) toast.error("Impossible de vérifier les retours déjà importés.");
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [projectId, text, mapping, signature, rows.length]);

  const matchesReady = matches?.signature === signature && matches.items.length === rows.length;
  const rowStatus = (index: number) => edits[index]?.status ?? rows[index].status;
  // L'état modifié dans l'aperçu compte : changer « Fait » en « À faire » sur une ligne déjà importée propose la mise à jour.
  const classifications =
    matchesReady && matches
      ? classifyRows(
          rows.map((_, index) => ({ key: matches.items[index].key, status: rowStatus(index) })),
          new Map(matches.items.flatMap((item) => (item.match ? [[item.key, item.match] as const] : []))),
        )
      : rows.map(() => ({ kind: "new" as const }));

  const modes = rows.map((_, index) => edits[index]?.mode ?? defaultMode(classifications[index]));
  const counts = countModes(modes);

  // Date de réception : la plus récente des lignes importées (colonne Date du tableau), sinon aujourd’hui.
  const now = new Date();
  const receivedDates = rows
    .map((row, index) => (modes[index] === "skip" ? null : parseSheetDate(row.date, now)))
    .filter((date): date is Date => date !== null);
  const received = receivedDates.length ? new Date(Math.max(...receivedDates.map((d) => d.getTime()))) : now;
  const source = sourceInput ?? `Retours du ${formatParis(received, "dd/MM")}`;

  const setEdit = (index: number, patch: RowEdit) =>
    setEdits((current) => ({ ...current, [index]: { ...current[index], ...patch } }));

  const changeText = (value: string) => {
    setText(value);
    setMappingOverride(null);
    setEdits({});
  };
  const changeMapping = (patch: Partial<ColumnMapping>) => {
    setMappingOverride({ ...mapping, ...patch });
    setEdits({});
  };

  const submit = () =>
    startTransition(async () => {
      const result = await importFeedback(projectId, {
        text,
        mapping,
        source,
        rows: Object.entries(edits).map(([index, edit]) => ({
          index: Number(index),
          mode: edit.mode,
          zone: edit.zone,
          status: edit.status,
        })),
        assigneeId: assigneeId || null,
        priority,
        dueDate: dueDate || null,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      const parts = [];
      if (result.created > 0) parts.push(`${result.created} ${result.created > 1 ? "tâches créées" : "tâche créée"}`);
      if (result.updated > 0) parts.push(`${result.updated} ${result.updated > 1 ? "mises à jour" : "mise à jour"}`);
      toast.success(parts.join(" · ") || "Rien à importer");
      onClose();
      // Atterrissage sur la liste filtrée par la source de cet import.
      if (result.created > 0) router.push(`${pathname}?vue=liste&source=${encodeURIComponent(result.source)}`);
    });

  const columnOptions = Array.from({ length: detected.columnCount }, (_, index) => ({
    value: String(index),
    label: `Colonne ${columnLetter(index)}${mapping.hasHeader && detected.rows[0]?.[index]?.trim() ? ` · ${detected.rows[0][index].trim()}` : ""}`,
  }));
  const columnSelect = (id: string, label: string, value: number, onChange: (index: number) => void, optional = true) => (
    <div>
      <label htmlFor={id} className={labelClass}>Colonne {label}</label>
      <select id={id} value={String(value)} onChange={(event) => onChange(Number(event.target.value))} className={cn(fieldClass, "py-1.5 text-[13px]")}>
        {optional && <option value={NONE}>(aucune)</option>}
        {columnOptions.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="Importer un tableau de retours"
      description="Copiez les cellules depuis Google Sheets ou Excel (en-têtes compris) et collez-les ici. Les lignes déjà importées sont repérées : rien n’est créé en double."
    >
      <div className="space-y-3">
        <div>
          <label htmlFor="import-text" className={labelClass}>Tableau collé</label>
          <textarea
            id="import-text"
            value={text}
            onChange={(event) => changeText(event.target.value)}
            rows={rows.length > 0 ? 3 : 6}
            placeholder={"Date\tPage\tRetour\tCommentaire\tÉtat\n05/10\tHomepage\tInsérer la vidéo dans le bloc…\t\tPas fait"}
            className={cn(fieldClass, "font-mono text-[12px]")}
          />
        </div>

        {detected.rows.length > 0 && (
          <details open={detected.ambiguous} className="rounded-lg border border-line bg-surface-2 px-3 py-2">
            <summary className="cursor-pointer text-[12px] font-medium text-ink-2">
              Colonnes{detected.ambiguous ? " : vérifiez l’affectation" : ""}
            </summary>
            <div className="mt-2 space-y-2">
              {detected.ambiguous && (
                <p role="status" className="text-[12px] text-muted">
                  {mapping.hasHeader
                    ? "La colonne Retour n’a pas été reconnue : choisissez-la ci-dessous."
                    : "Aucun en-tête reconnu : l’ordre Date, Page, Retour, Commentaire, État est supposé. Corrigez-le si besoin."}
                </p>
              )}
              <label className="flex items-center gap-2 text-[12px] text-ink-2">
                <input
                  type="checkbox"
                  checked={mapping.hasHeader}
                  onChange={(event) => changeMapping({ hasHeader: event.target.checked })}
                  className="accent-[var(--accent)]"
                />
                La première ligne contient les en-têtes
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                {columnSelect("map-retour", "Retour", mapping.retour, (retour) => changeMapping({ retour }), false)}
                {columnSelect("map-page", "Page", mapping.page, (page) => changeMapping({ page }))}
                {columnSelect("map-etat", "État", mapping.etat, (etat) => changeMapping({ etat }))}
                {columnSelect("map-date", "Date", mapping.date, (date) => changeMapping({ date }))}
                {columnSelect("map-comment", "Commentaire", mapping.comments[0] ?? -1, (index) =>
                  changeMapping({ comments: index >= 0 ? [index] : [] }),
                )}
              </div>
            </div>
          </details>
        )}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-line">
            <p className="flex items-center justify-between gap-2 border-b border-line bg-surface-2 px-3 py-2 text-[12px] font-medium text-ink-2" aria-live="polite">
              <span>
                {rows.length} ligne{rows.length > 1 ? "s" : ""} · {counts.create} à créer · {counts.update} à mettre à jour · {counts.skip} ignorée{counts.skip > 1 ? "s" : ""}
              </span>
              {!matchesReady && <span className="text-muted">Vérification…</span>}
            </p>
            <ul className="max-h-72 overflow-y-auto scroll-thin">
              {rows.map((row, index) => {
                const classification = classifications[index];
                const mode = modes[index];
                const options = modesFor(classification).filter(
                  (value) => value !== "update" || (classification.kind === "existing" && classification.statusChanged),
                );
                return (
                  <li key={index} className={cn("flex gap-2.5 border-b border-line px-3 py-2 text-[12px] last:border-b-0", mode === "skip" && "bg-surface-2 text-muted")}>
                    <input
                      type="checkbox"
                      checked={mode !== "skip"}
                      onChange={(event) =>
                        setEdit(index, { mode: event.target.checked ? modeWhenChecked(classification) : "skip" })
                      }
                      aria-label={`Importer la ligne ${index + 1}`}
                      className="mt-1 accent-[var(--accent)]"
                    />
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusIcon status={rowStatus(index)} size={13} />
                        <select
                          value={rowStatus(index)}
                          onChange={(event) => setEdit(index, { status: event.target.value as TaskStatus })}
                          aria-label={`État de la ligne ${index + 1}`}
                          className="rounded-md border border-line bg-surface px-1.5 py-1 text-[12px]"
                        >
                          {TASK_STATUSES.map((status) => (
                            <option key={status.value} value={status.value}>{status.short}</option>
                          ))}
                        </select>
                        <input
                          value={edits[index]?.zone ?? row.zone ?? ""}
                          onChange={(event) => setEdit(index, { zone: event.target.value })}
                          aria-label={`Page de la ligne ${index + 1}`}
                          placeholder="Page"
                          className="w-28 rounded-md border border-line bg-surface px-1.5 py-1 text-[12px]"
                        />
                        <span
                          className={cn(
                            "rounded px-1.5 py-0.5 text-[11px] font-medium",
                            classification.kind === "new" && "bg-done-soft text-done-text",
                            classification.kind === "existing" && classification.statusChanged && "bg-waiting-soft text-waiting-text",
                            (classification.kind === "paste-duplicate" || (classification.kind === "existing" && !classification.statusChanged)) && "bg-sunken text-muted",
                          )}
                        >
                          {classificationLabel(classification, rowStatus(index))}
                        </span>
                        {classification.kind !== "new" && (
                          <select
                            value={mode}
                            onChange={(event) => setEdit(index, { mode: event.target.value as ImportMode })}
                            aria-label={`Action pour la ligne ${index + 1}`}
                            className="rounded-md border border-line bg-surface px-1.5 py-1 text-[12px]"
                          >
                            {options.map((value) => (
                              <option key={value} value={value}>{MODE_LABELS[value]}</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <p className="truncate" title={row.title}>{row.title}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {rows.length > 0 && (
          <fieldset className="grid gap-2 sm:grid-cols-4">
            <legend className="sr-only">Valeurs communes aux tâches créées</legend>
            <div className="sm:col-span-4">
              <label htmlFor="import-source" className={labelClass}>Source</label>
              <input id="import-source" value={source} onChange={(event) => setSourceInput(event.target.value)} className={fieldClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="import-assignee" className={labelClass}>Attribuer à</label>
              <select id="import-assignee" value={assigneeId} onChange={(event) => setAssigneeId(event.target.value)} className={fieldClass}>
                <option value="">Personne</option>
                {team.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="import-priority" className={labelClass}>Priorité</label>
              <select id="import-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)} className={fieldClass}>
                {[...PRIORITIES].reverse().map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="import-due" className={labelClass}>Échéance</label>
              <input id="import-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={fieldClass} />
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <GhostButton type="button" onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton type="button" disabled={pending || !matchesReady || counts.create + counts.update === 0} onClick={submit}>
            {pending ? "Import…" : importButtonLabel(counts)}
          </PrimaryButton>
        </div>
      </div>
    </Dialog>
  );
}

/** Mode retenu quand on recoche une ligne ignorée : mettre à jour si l’état a changé, sinon créer quand même. */
function modeWhenChecked(classification: RowClassification): ImportMode {
  if (classification.kind === "new") return "create";
  if (classification.kind === "existing" && classification.statusChanged) return "update";
  return "force";
}
