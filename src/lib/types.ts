import type { Priority, TaskStatus } from "@prisma/client";

/** Tâche telle qu'affichée sur le tableau, la liste et « Aujourd'hui ». */
export type TaskCard = {
  id: string;
  number: number;
  title: string;
  status: TaskStatus;
  priority: Priority;
  zone: string | null;
  source: string | null;
  billable: boolean;
  dueDate: Date | null;
  position: number;
  completedAt: Date | null;
  updatedAt: Date;
  statusChangedAt: Date;
  assigneeId: string | null;
  assignee: { id: string; name: string; color: string } | null;
  _count: { comments: number };
};

export const taskCardSelect = {
  id: true,
  number: true,
  title: true,
  status: true,
  priority: true,
  zone: true,
  source: true,
  billable: true,
  dueDate: true,
  position: true,
  completedAt: true,
  updatedAt: true,
  statusChangedAt: true,
  assigneeId: true,
  assignee: { select: { id: true, name: true, color: true } },
  _count: { select: { comments: true } },
} as const;
