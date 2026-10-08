"use client";

import { Pencil } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateProjectNote } from "@/app/actions/projects";
import { GhostButton, PrimaryButton } from "@/components/dialog";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";

/** Point d'étape du projet : en une ou deux phrases, où on en est et la prochaine action. */
export function ProjectNote({ projectId, note, noteAt }: { projectId: string; note: string | null; noteAt: Date | null }) {
  const [editing, setEditing] = useState(false);
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
      <div className="mt-3 max-w-3xl">
        <textarea
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
          className="w-full resize-none rounded-md border border-accent bg-surface px-3 py-2 text-ui leading-relaxed outline-none placeholder:text-faint"
        />
        <div className="mt-1.5 flex items-center gap-2">
          <PrimaryButton type="button" disabled={pending} onClick={save} className="px-3 py-1.5 text-xs">Enregistrer</PrimaryButton>
          <GhostButton type="button" onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs">Annuler</GhostButton>
          <span className="ml-auto text-meta text-muted">Ctrl + Entrée pour enregistrer · {draft.length}/600</span>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      className={cn(
        "group mt-3 block w-full max-w-3xl rounded-md px-3 py-2 text-left transition-colors",
        saved ? "bg-surface-2 hover:bg-sunken" : "border border-dashed border-line-strong text-muted hover:border-accent hover:text-ink",
      )}
    >
      {saved ? (
        <>
          <span className="flex items-center gap-1.5 text-meta font-semibold uppercase tracking-wider text-muted">
            Point d&apos;étape
            {noteAt && (
              <span className="font-normal normal-case tracking-normal" title={formatDateTime(noteAt)} suppressHydrationWarning>
                · {timeAgo(noteAt)}
              </span>
            )}
            <Pencil className="ml-auto size-3 opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
          <span className="mt-0.5 block text-ui leading-relaxed text-ink-2">{saved}</span>
        </>
      ) : (
        <span className="flex items-center gap-2 text-ui">
          <Pencil className="size-3.5" /> Ajouter un point d&apos;étape : où on en est, et la prochaine action
        </span>
      )}
    </button>
  );
}
