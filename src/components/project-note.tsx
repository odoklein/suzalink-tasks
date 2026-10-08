"use client";

import { ChevronDown, Pencil } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProjectNote } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/** Point d'étape du projet : en une ou deux phrases, où on en est et la prochaine action. */
export function ProjectNote({ projectId, note, noteAt }: { projectId: string; note: string | null; noteAt: Date | null }) {
  const [editing, setEditing] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saved, setSaved] = useState<string | null>(note);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLTextAreaElement>(null);

  // Les données serveur font foi dès qu'elles changent.
  const [syncedNote, setSyncedNote] = useState(note);
  if (syncedNote !== note) {
    setSyncedNote(note);
    setSaved(note);
    if (!editing) setDraft(note ?? "");
  }

  const start = () => {
    setDraft(saved ?? "");
    setEditing(true);
    requestAnimationFrame(() => ref.current?.focus());
  };

  const save = () =>
    startTransition(async () => {
      const text = draft.trim();
      setSaved(text || null);
      setEditing(false);
      await updateProjectNote(projectId, text);
      toast.success(text ? "Point d'étape enregistré" : "Point d'étape retiré");
    });

  if (editing) {
    return (
      <div className="mt-3 max-w-[var(--page-narrow)]">
        <Textarea
          ref={ref}
          value={draft}
          rows={3}
          maxLength={600}
          aria-label="Point d'étape"
          placeholder="Où en est le projet ? Qu'attend-on, de qui, et quelle est la prochaine action ?"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              save();
            }
            if (event.key === "Escape") {
              event.stopPropagation();
              setEditing(false);
            }
          }}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <Button variant="primary" size="sm" loading={pending} onClick={save}>Enregistrer</Button>
          <Button size="sm" onClick={() => setEditing(false)}>Annuler</Button>
          <span className="ml-auto text-meta text-muted">Ctrl + Entrée pour enregistrer · {draft.length}/600</span>
        </div>
      </div>
    );
  }

  if (!saved) {
    return (
      <button
        type="button"
        onClick={start}
        className="mt-3 flex items-center gap-2 rounded-sm text-ui text-muted outline-hidden hover:text-ink focus-visible:shadow-[var(--ring)]"
      >
        <Pencil className="size-3.5" /> Ajouter un point d&apos;étape : où on en est, et la prochaine action
      </button>
    );
  }

  // Une ligne dans une barre discrète ; le chevron déplie le texte, un clic sur le texte l’édite.
  return (
    <div className="group mt-3 flex items-start gap-2 rounded-md bg-surface-2 px-3 py-1.5">
      <button type="button" onClick={start} className="min-w-0 flex-1 rounded-sm text-left outline-hidden focus-visible:shadow-[var(--ring)]">
        <span className={cn("block text-ui leading-relaxed text-ink-2", !expanded && "truncate")}>
          <span className="mr-1.5 text-xs font-semibold text-muted">Point d&apos;étape</span>
          {saved}
        </span>
      </button>
      {noteAt && (
        <Tooltip content={formatDateTime(noteAt)}>
          <span className="shrink-0 pt-0.5 text-xs text-muted" suppressHydrationWarning>
            {timeAgo(noteAt)}
          </span>
        </Tooltip>
      )}
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={expanded ? "Replier le point d’étape" : "Déplier le point d’étape"}
        className="shrink-0 rounded-sm p-0.5 text-muted outline-hidden hover:bg-sunken hover:text-ink focus-visible:shadow-[var(--ring)]"
      >
        <ChevronDown className={cn("size-4 transition-transform", expanded && "rotate-180")} />
      </button>
    </div>
  );
}
