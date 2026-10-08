"use client";

import type { TaskStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { quickAddTask } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { parseQuickAdd } from "@/lib/quick-add";
import { cn } from "@/lib/utils";

const TOKEN_TONE: Record<string, string> = {
  assignee: "bg-accent-soft text-accent",
  priority: "bg-danger-soft text-danger",
  zone: "bg-sunken text-ink-2",
  due: "bg-[color-mix(in_srgb,var(--st-waiting)_14%,transparent)] text-st-waiting",
  billable: "bg-[color-mix(in_srgb,var(--st-waiting)_14%,transparent)] text-st-waiting",
  ambiguous: "bg-[color-mix(in_srgb,var(--st-waiting)_14%,transparent)] text-st-waiting",
};

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
      const result = await quickAddTask(projectId, value, status, parsed.assigneeId);
      if (!result.ok) {
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
        "rounded-lg border border-line bg-surface transition-colors focus-within:border-accent",
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
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
        />
      </div>
      {parsed.tokens.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1 pl-5">
          {parsed.tokens.map((token, index) => (
            <span key={`${token.kind}-${index}`} className={cn("rounded px-1.5 py-0.5 text-[11px] font-medium", TOKEN_TONE[token.kind])}>
              {token.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
