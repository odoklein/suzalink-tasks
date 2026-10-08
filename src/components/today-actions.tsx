"use client";

import { CalendarClock, UserRoundCheck } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { updateTask } from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import { ProjectTile } from "@/components/primitives";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { Floating } from "@/components/ui/floating";
import { addDaysISO, quickPicks } from "@/lib/date-picker";
import { toParisDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";

/** Bouton qui ouvre une tâche dans le tiroir, utilisable depuis une page serveur. */
export function TaskLink({
  taskId,
  taskRef,
  className,
  children,
}: {
  taskId: string;
  taskRef: string;
  className?: string;
  children: React.ReactNode;
}) {
  const { openTask } = useApp();
  return (
    <button
      type="button"
      onClick={() => openTask(taskId, taskRef)}
      className={cn("min-w-0 rounded-xs text-left outline-hidden hover:underline focus-visible:shadow-[var(--ring)]", className)}
    >
      {children}
    </button>
  );
}

/**
 * Actions rapides d’une ligne (survol ou focus) : « Me l’attribuer » et « Reporter » (Demain,
 * Lundi prochain, +1 sem), sans ouvrir le tiroir. Toujours visibles sur écran tactile.
 */
export function TaskRowActions({ taskId, assigneeId }: { taskId: string; assigneeId: string | null }) {
  const { user } = useApp();
  const [pending, startTransition] = useTransition();

  const patch = (changes: Parameters<typeof updateTask>[1], done: string) =>
    startTransition(async () => {
      const result = await updateTask(taskId, changes);
      if ("error" in result && result.error) toast.error(result.error);
      else toast.success(done);
    });

  const postponeItems = useMemo(() => {
    const today = toParisDateInput(new Date());
    const picks = quickPicks(today);
    return [
      { label: "Demain", value: addDaysISO(today, 1) },
      { label: "Lundi prochain", value: picks[2].value as string },
      { label: "+1 sem", value: addDaysISO(today, 7) },
    ];
  }, []);

  return (
    <span
      className={cn(
        "flex shrink-0 items-center gap-1 transition-opacity",
        "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 pointer-coarse:opacity-100",
        pending && "opacity-100",
      )}
    >
      {assigneeId !== user.id && (
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          icon={<UserRoundCheck className="size-3.5" />}
          onClick={() => patch({ assigneeId: user.id }, "Tâche attribuée à vous")}
        >
          <span className="max-lg:sr-only">Me l’attribuer</span>
        </Button>
      )}
      <ActionMenu
        label="Reporter l’échéance"
        items={postponeItems.map((option) => ({
          label: option.label,
          onSelect: () => patch({ dueDate: option.value }, `Reportée : ${option.label.toLowerCase()}`),
        }))}
        trigger={(props) => (
          <Button {...props} size="sm" variant="ghost" icon={<CalendarClock className="size-3.5" />}>
            <span className="max-lg:sr-only">Reporter</span>
          </Button>
        )}
      />
    </span>
  );
}

export type WeekDay = {
  key: string;
  /** « lun. », ou « Auj. » pour le jour même */
  short: string;
  /** Initiale, sur téléphone */
  letter: string;
  /** Libellé complet, pour les lecteurs d’écran : « jeudi 8 octobre » */
  label: string;
  number: string;
  isToday: boolean;
  tasks: { id: string; ref: string; title: string; color: string; projectKey: string }[];
};

/** Les 7 prochains jours ; chaque jour ouvre la liste de ses tâches. */
export function WeekStrip({ days }: { days: WeekDay[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const { openTask } = useApp();
  const current = days.find((day) => day.key === openKey);

  return (
    <section aria-label="Les 7 prochains jours" className="mt-3 grid grid-cols-7 gap-1.5 rounded-lg border border-line bg-surface p-1.5 shadow-card">
      {days.map((day) => (
        <button
          key={day.key}
          type="button"
          aria-expanded={openKey === day.key}
          aria-label={`${day.label} : ${day.tasks.length ? `${day.tasks.length} échéance${day.tasks.length > 1 ? "s" : ""}` : "aucune échéance"}`}
          onClick={(event) => {
            setAnchor(event.currentTarget);
            setOpenKey((key) => (key === day.key ? null : day.key));
          }}
          className={cn(
            "rounded-md px-1.5 py-2 text-left outline-hidden focus-visible:shadow-[var(--ring)] sm:px-2.5",
            day.isToday ? "bg-ink text-bg dark:bg-accent-soft dark:text-accent dark:ring-1 dark:ring-accent/30" : "hover:bg-surface-2",
          )}
        >
          <span className={cn("block text-meta font-medium capitalize", day.isToday ? "text-bg/70 dark:text-accent" : "text-muted")}>
            <span className="max-sm:hidden">{day.short}</span>
            <span className="sm:hidden">{day.letter}</span>
          </span>
          <span className="mt-0.5 flex items-baseline justify-between gap-2">
            <span className="tabular text-title font-semibold">{day.number}</span>
            {day.tasks.length > 0 && (
              <span className={cn("tabular rounded-full px-1.5 text-meta font-semibold max-sm:hidden", day.isToday ? "bg-bg/15" : "bg-accent-soft text-accent")}>
                {day.tasks.length}
              </span>
            )}
          </span>
          <span className="mt-1 flex gap-0.5 sm:hidden" aria-hidden="true">
            {day.tasks.slice(0, 5).map((task) => (
              <span key={task.id} className="size-1.5 rounded-full" style={{ backgroundColor: task.color }} />
            ))}
          </span>
          <span className="mt-1.5 flex h-1 gap-0.5 max-sm:hidden" aria-hidden="true">
            {day.tasks.slice(0, 5).map((task) => (
              <span key={task.id} className="flex-1 rounded-full" style={{ backgroundColor: task.color }} />
            ))}
          </span>
        </button>
      ))}
      <Floating
        anchor={anchor}
        open={Boolean(current)}
        onDismiss={() => setOpenKey(null)}
        role="dialog"
        aria-label={current ? `Échéances du ${current.label}` : undefined}
        className="animate-pop-in w-72 rounded-lg border border-line bg-surface p-2 shadow-pop"
      >
        {current && (
          <>
            <p className="px-1.5 pb-1.5 text-xs font-semibold capitalize text-muted">{current.label}</p>
            {current.tasks.length === 0 ? (
              <p className="px-1.5 pb-1 text-ui text-muted">Aucune échéance ce jour-là.</p>
            ) : (
              <ul>
                {current.tasks.map((task) => (
                  <li key={task.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpenKey(null);
                        openTask(task.id, task.ref);
                      }}
                      className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-ui outline-hidden hover:bg-sunken focus-visible:bg-sunken"
                    >
                      <ProjectTile color={task.color} label={task.projectKey} size={14} />
                      <span className="w-12 shrink-0 font-mono text-meta text-muted">{task.ref}</span>
                      <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Floating>
    </section>
  );
}
