"use client";

import { MessageSquare, MoreHorizontal } from "lucide-react";

import { useApp } from "@/components/app-context";
import {
  AgeChip,
  Avatar,
  BillableBadge,
  DueChip,
  EmptyAvatar,
  PriorityIcon,
  StatusIcon,
  ZoneChip,
} from "@/components/primitives";
import { ActionMenu } from "@/components/ui/action-menu";
import { Button } from "@/components/ui/button";
import { TASK_STATUSES } from "@/lib/constants";
import { plural } from "@/lib/plural";
import type { TaskCard as TaskCardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@prisma/client";

/** Ce que dnd-kit pose sur l’élément qui sert de poignée : tout le corps de la carte. */
export type CardHandle = {
  ref: (element: HTMLElement | null) => void;
  props: React.HTMLAttributes<HTMLElement>;
};

/**
 * Carte de tâche. Un seul élément focusable porte la carte : le bouton qui ouvre la tâche (Entrée)
 * et qui, avec `handle`, lève la carte au clavier (Espace). `onMove` ajoute « Déplacer vers… » :
 * l’alternative au glisser (WCAG 2.5.7), visible au survol et au focus, toujours visible au toucher.
 */
export function TaskCard({
  task,
  projectKey,
  dragging = false,
  className,
  handle,
  onMove,
}: {
  task: TaskCardData;
  projectKey: string;
  dragging?: boolean;
  className?: string;
  handle?: CardHandle;
  onMove?: (status: TaskStatus) => void;
}) {
  const { openTask } = useApp();
  const done = task.status === "DONE";
  const ref = `${projectKey}-${task.number}`;

  return (
    <div
      className={cn(
        "group relative rounded-md border border-line bg-surface shadow-card transition-[border-color,box-shadow] duration-[var(--dur-1)]",
        "hover:border-line-strong hover:shadow-raised",
        dragging && "rotate-[1.5deg] border-accent shadow-pop",
        className,
      )}
    >
      <button
        {...handle?.props}
        ref={handle?.ref}
        type="button"
        onClick={() => openTask(task.id, ref)}
        // Espace lève la carte (dnd-kit, au keydown) : sans cela, Firefox déclencherait aussi le clic au keyup.
        onKeyUp={(event) => {
          if (event.key === " ") event.preventDefault();
        }}
        className="block w-full cursor-pointer touch-manipulation rounded-md p-3 text-left outline-hidden focus-visible:shadow-[var(--ring)]"
      >
        <span className="flex items-start gap-2 pointer-coarse:pr-7">
          <span className={cn("line-clamp-3 min-w-0 flex-1 text-ui font-medium leading-snug", done && "text-muted line-through decoration-faint")}>
            {task.title}
          </span>
          {task.priority !== "NONE" && (
            <span className="mt-0.5 shrink-0">
              <PriorityIcon priority={task.priority} />
            </span>
          )}
        </span>
        <span className="mt-2.5 flex items-center gap-1.5">
          {task.status === "WAITING_CLIENT" && <AgeChip since={task.statusChangedAt} />}
          <ZoneChip zone={task.zone} />
          <DueChip date={task.dueDate} done={done} className="min-w-0" />
          {task.billable && <BillableBadge />}
          <span className="ml-auto flex items-center gap-2">
            {task._count.comments > 0 && (
              <span className="tabular flex items-center gap-0.5 text-meta text-muted">
                <MessageSquare className="size-3" />
                <span aria-hidden="true">{task._count.comments}</span>
                <span className="sr-only">{plural(task._count.comments, "commentaire")}</span>
              </span>
            )}
            <span className="font-mono text-meta text-muted">
              {projectKey}-{task.number}
            </span>
            {task.assignee ? (
              <Avatar name={task.assignee.name} color={task.assignee.color} size={20} />
            ) : (
              <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <EmptyAvatar size={20} />
              </span>
            )}
          </span>
        </span>
      </button>
      {onMove && !dragging && (
        <ActionMenu
          label={`Déplacer ${ref}`}
          items={TASK_STATUSES.filter((status) => status.value !== task.status).map((status) => ({
            label: status.label,
            icon: <StatusIcon status={status.value} />,
            onSelect: () => onMove(status.value),
          }))}
          trigger={(props) => (
            <Button
              {...props}
              size="icon"
              aria-label={`Déplacer ${ref} vers…`}
              className={cn(
                "absolute right-1.5 top-1.5 size-7 rounded-sm bg-surface text-muted shadow-xs pointer-coarse:after:-inset-2",
                // Au survol, la carte offre l’action ; au clavier, le focus la montre ; au toucher, elle reste là.
                "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 pointer-coarse:opacity-100",
              )}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          )}
        />
      )}
    </div>
  );
}
