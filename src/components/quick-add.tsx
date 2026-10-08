"use client";

import type { Priority, TaskStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import { toast } from "sonner";

import { quickAddTask } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { softColor, strongColor } from "@/lib/color";
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
  status,
  placeholder = "Nouvelle tâche…",
  compact = false,
  autoFocus = false,
  onDone,
}: {
  projectId: string;
  status?: TaskStatus;
  placeholder?: string;
  compact?: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const { team } = useApp();
  const [value, setValue] = useState("");
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const parsed = useMemo(() => parseQuickAdd(value, team), [value, team]);

  const submit = () => {
    if (!parsed.title.trim()) return;
    startTransition(async () => {
      const result = await quickAddTask(projectId, value, status);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      setValue("");
      input.current?.focus();
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
          disabled={pending}
          onChange={(event) => setValue(event.target.value)}
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
