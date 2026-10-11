"use client";

import type { TaskStatus } from "@prisma/client";
import { MessageSquare } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { updateTask } from "@/app/actions/tasks";
import { useAnnounce } from "@/components/announcer";
import { useApp } from "@/components/app-context";
import {
  AgeChip,
  Avatar,
  BillableBadge,
  DueChip,
  EmptyAvatar,
  PriorityIcon,
  ProjectTile,
  StatusIcon,
  ZoneChip,
} from "@/components/primitives";
import { SelectMenu } from "@/components/select-menu";
import { STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants";
import { plural } from "@/lib/plural";
import type { TaskCard } from "@/lib/types";
import { cn } from "@/lib/utils";
import { promptWaitingFor } from "@/lib/waiting-prompt";

/** Ligne de tâche : statut modifiable sur place, clic pour ouvrir le détail. */
export function TaskRow({
  task,
  projectKey,
  project,
  showZone = true,
  arrived = false,
}: {
  task: TaskCard;
  projectKey: string;
  project?: { name: string; color: string };
  showZone?: boolean;
  /** La ligne vient d’arriver (nouvelle tâche, changement de statut) : fondu d’entrée. */
  arrived?: boolean;
}) {
  const { openTask } = useApp();
  const announce = useAnnounce();
  const [pending, startTransition] = useTransition();
  const done = task.status === "DONE";

  const setStatus = (status: TaskStatus) =>
    startTransition(async () => {
      const result = await updateTask(task.id, { status });
      if (!result.ok) toast.error(result.error);
      else {
        announce(`${projectKey}-${task.number} : ${STATUS_BY_VALUE[status].label}.`);
        if (status === "WAITING_CLIENT" && task.status !== "WAITING_CLIENT") {
          promptWaitingFor({ taskId: task.id, ref: `${projectKey}-${task.number}` });
        }
      }
    });

  return (
    <li
      className={cn(
        "group flex items-center gap-2 border-b border-line px-3 py-1.5 transition-colors last:border-b-0 hover:bg-surface-2",
        pending && "opacity-60",
        arrived && "animate-arrive",
      )}
    >
      <SelectMenu<TaskStatus>
        label="Changer le statut"
        value={task.status}
        onChange={setStatus}
        options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label, icon: <StatusIcon status={s.value} /> }))}
        trigger={<StatusIcon status={task.status} />}
      />
      <button
        type="button"
        onClick={() => openTask(task.id, `${projectKey}-${task.number}`)}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-1 text-left"
      >
        <span className="min-w-12 shrink-0 whitespace-nowrap font-mono text-meta text-muted">
          {projectKey}-{task.number}
        </span>
        {project && <ProjectTile color={project.color} label={projectKey} size={16} />}
        <span className={cn("min-w-0 flex-1 truncate text-ui", done && "text-muted line-through decoration-faint")}>
          {task.title}
        </span>
        {task.billable && <BillableBadge />}
        {showZone && (
          <span className="hidden sm:contents">
            <ZoneChip zone={task.zone} />
          </span>
        )}
        {task._count.comments > 0 && (
          <span className="tabular flex items-center gap-0.5 text-meta text-muted">
            <MessageSquare className="size-3" />
            <span aria-hidden="true">{task._count.comments}</span>
            <span className="sr-only">{plural(task._count.comments, "commentaire")}</span>
          </span>
        )}
        {task.status === "WAITING_CLIENT" && <AgeChip since={task.statusChangedAt} />}
        <DueChip date={task.dueDate} done={done} />
        <PriorityIcon priority={task.priority} />
        {task.assignee ? (
          <Avatar name={task.assignee.name} color={task.assignee.color} size={20} />
        ) : (
          <EmptyAvatar size={20} />
        )}
      </button>
    </li>
  );
}
