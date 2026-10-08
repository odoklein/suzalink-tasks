"use client";

import { MessageSquare } from "lucide-react";

import { useApp } from "@/components/app-context";
import {
  Avatar,
  BillableBadge,
  DueChip,
  EmptyAvatar,
  PriorityIcon,
  ZoneChip,
} from "@/components/primitives";
import type { TaskCard as TaskCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskCard({
  task,
  projectKey,
  dragging = false,
}: {
  task: TaskCardData;
  projectKey: string;
  dragging?: boolean;
}) {
  const { openTask } = useApp();
  const done = task.status === "DONE";

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTask(task.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter") openTask(task.id);
      }}
      className={cn(
        "group cursor-pointer rounded-md border border-line bg-surface p-3 shadow-card transition-[border-color,box-shadow]",
        "hover:border-line-strong",
        dragging && "rotate-[1.5deg] border-accent shadow-pop",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-meta text-muted">
          {projectKey}-{task.number}
        </span>
        {task.billable && <BillableBadge />}
        <span className="ml-auto">
          <PriorityIcon priority={task.priority} />
        </span>
      </div>
      <p className={cn("mt-1.5 line-clamp-3 text-ui font-medium leading-snug", done && "text-muted line-through decoration-faint")}>
        {task.title}
      </p>
      <div className="mt-2.5 flex items-center gap-1.5">
        <ZoneChip zone={task.zone} />
        <DueChip date={task.dueDate} done={done} className="min-w-0" />
        <span className="ml-auto flex items-center gap-2">
          {task._count.comments > 0 && (
            <span className="tabular flex items-center gap-0.5 text-meta text-muted">
              <MessageSquare className="size-3" />
              {task._count.comments}
            </span>
          )}
          {task.assignee ? (
            <Avatar name={task.assignee.name} color={task.assignee.color} size={20} />
          ) : (
            <EmptyAvatar size={20} />
          )}
        </span>
      </div>
    </div>
  );
}
