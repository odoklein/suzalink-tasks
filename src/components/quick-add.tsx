"use client";

import type { Priority, TaskStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { useId, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { toast } from "sonner";

import { quickAddTask } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { softColor, strongColor } from "@/lib/color";
import { rememberLastProject } from "@/lib/last-project";
import { parseQuickAdd, type QuickAddResult } from "@/lib/quick-add";
import { cn } from "@/lib/utils";

/**
 * Une couleur = un sens : urgence en danger/orange (comme DueChip), échéance en accent,
 * hors périmètre en encre (comme BillableBadge), personne en couleur douce du membre.
 */
const PRIORITY_TONE: Record<Priority, string> = {
  URGENT: "bg-danger-soft text-danger-text",
  HIGH: "bg-soon-soft text-soon-text",
  MEDIUM: "bg-sunken text-ink-2",
  LOW: "bg-sunken text-muted",
  NONE: "bg-sunken text-muted",
};

function tokenStyle(
  token: QuickAddResult["tokens"][number],
  parsed: QuickAddResult,
  team: { id: string; color: string }[],
): { className: string; style?: CSSProperties } {
  switch (token.kind) {
    case "priority":
      return { className: PRIORITY_TONE[parsed.priority ?? "NONE"] };
    case "due":
      return { className: "bg-accent-soft text-accent" };
    case "billable":
      return { className: "bg-ink text-bg" };
    case "ambiguous":
      return { className: "bg-soon-soft text-soon-text" };
    case "assignee": {
      const color = team.find((member) => member.id === parsed.assigneeId)?.color;
      return {
        className: "bg-[var(--chip-bg)] text-[var(--chip-fg)]",
        style: {
          "--chip-bg": softColor(color),
          "--chip-fg": strongColor(color),
        } as CSSProperties,
      };
    }
    default:
      return { className: "bg-sunken text-ink-2" };
  }
}

/** Saisie rapide avec aperçu en direct des éléments reconnus. */
export function QuickAdd({
  projectId,
  projectSlug,
  status,
  placeholder = "Nouvelle tâche…",
  compact = false,
  autoFocus = false,
  onDone,
  roundId,
}: {
  projectId: string;
  /** Si fourni, mémorisé comme dernier projet utilisé après une création. */
  projectSlug?: string;
  status?: TaskStatus;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
  /** Ajoute la tâche à ce lot de retours ouvert (P4-06). */
  roundId?: string;
}) {
  const { team, openTask } = useApp();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseQuickAdd(value, team), [value, team]);
  const errorId = useId();

  // Le champ reste actif pendant l'enregistrement : on le vide tout de suite pour enchaîner
  // la tâche suivante, et on remet le texte en cas d'échec.
  const submit = () => {
    const text = value;
    const snapshot = parsed;
    if (!snapshot.title.trim()) {
      setError("Ajoutez un titre");
      return;
    }
    setValue("");
    setError(null);
    startTransition(async () => {
      const result = await quickAddTask(projectId, text, status, { roundId, resolvedAssigneeId: snapshot.assigneeId });
      if (!result.ok) {
        toast.error(result.error);
        setValue((current) => current || text);
        return;
      }
      if (projectSlug) rememberLastProject(projectSlug);
      toast.success(`${result.ref} créée`, { action: { label: "Ouvrir", onClick: () => openTask(result.id) } });
    });
  };

  return (
    <div
      className={cn(
        "rounded-md border border-line bg-surface transition-colors focus-within:border-accent",
        compact ? "px-2 py-1.5" : "px-3 py-2",
      )}
    >
      <div className="flex items-center gap-2">
        <Plus className="size-3.5 shrink-0 text-faint" />
        <input
          ref={input}
          autoFocus={autoFocus}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          onChange={(event) => {
            setValue(event.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submit();
            }
            if (event.key === "Escape") {
              setValue("");
              onDone?.();
            }
          }}
          onBlur={() => !value && onDone?.()}
          placeholder={placeholder}
          aria-label={placeholder}
          className="min-w-0 flex-1 bg-transparent text-ui outline-none placeholder:text-faint"
        />
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 pl-5 text-[12px] text-danger">
          {error}
        </p>
      )}
      {parsed.tokens.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
          {parsed.tokens.map((token, index) => {
            const { className, style } = tokenStyle(token, parsed, team);
            return (
              <span key={`${token.kind}-${index}`} style={style} className={cn("rounded-xs px-1.5 py-0.5 text-meta font-medium", className)}>
                {token.label}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
