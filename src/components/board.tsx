"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { TaskStatus } from "@prisma/client";
import { Plus } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { moveTask } from "@/app/actions/tasks";
import { StatusIcon } from "@/components/primitives";
import { QuickAdd } from "@/components/quick-add";
import { TaskCard } from "@/components/task-card";
import { TASK_STATUSES } from "@/lib/constants";
import { computePosition } from "@/lib/position";
import type { TaskCard as TaskCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type Columns = Record<TaskStatus, TaskCardData[]>;

function toColumns(tasks: TaskCardData[]): Columns {
  const columns = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, [] as TaskCardData[]])) as Columns;
  for (const task of tasks) columns[task.status].push(task);
  for (const key of Object.keys(columns) as TaskStatus[]) {
    columns[key].sort((a, b) => a.position - b.position);
  }
  return columns;
}

function findColumn(columns: Columns, id: string): TaskStatus | undefined {
  if (id in columns) return id as TaskStatus;
  return (Object.keys(columns) as TaskStatus[]).find((key) => columns[key].some((task) => task.id === id));
}

export function Board({ projectId, projectKey, tasks }: { projectId: string; projectKey: string; tasks: TaskCardData[] }) {
  const [columns, setColumns] = useState<Columns>(() => toColumns(tasks));
  const [syncedTasks, setSyncedTasks] = useState(tasks);
  const [activeId, setActiveId] = useState<string | null>(null);
  // Déplacements en cours d'enregistrement : tant qu'il y en a, on n'écrase pas l'état optimiste.
  const [inflight, setInflight] = useState(0);
  const [, startTransition] = useTransition();
  // État des colonnes au début du glisser : on y revient si le serveur refuse le déplacement.
  const snapshot = useRef<Columns | null>(null);

  // Les données serveur font foi dès qu'elles changent (après chaque action) :
  // on resynchronise pendant le rendu plutôt que dans un effet. Pendant un glisser, ou tant qu'un
  // déplacement est en cours d'enregistrement, la resynchronisation attend (elle sera appliquée
  // ensuite, avec les données les plus récentes) pour ne pas faire sauter la carte sous le curseur.
  if (syncedTasks !== tasks && activeId === null && inflight === 0) {
    setSyncedTasks(tasks);
    setColumns(toColumns(tasks));
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const activeTask = useMemo(
    () => (activeId ? Object.values(columns).flat().find((task) => task.id === activeId) : undefined),
    [activeId, columns],
  );

  const onDragStart = (event: DragStartEvent) => {
    snapshot.current = columns;
    setActiveId(String(event.active.id));
  };

  // Déplacement entre colonnes pendant le glisser, pour un aperçu fidèle.
  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findColumn(columns, String(active.id));
    const to = findColumn(columns, String(over.id));
    if (!from || !to || from === to) return;
    setColumns((current) => {
      const moving = current[from].find((task) => task.id === active.id);
      if (!moving) return current;
      const target = current[to];
      const overIndex = target.findIndex((task) => task.id === over.id);
      const index = overIndex === -1 ? target.length : overIndex;
      return {
        ...current,
        [from]: current[from].filter((task) => task.id !== active.id),
        [to]: [...target.slice(0, index), { ...moving, status: to }, ...target.slice(index)],
      };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    const before = snapshot.current ?? toColumns(tasks);
    snapshot.current = null;
    if (!over) {
      // Lâché hors d'une colonne : on annule les déplacements d'aperçu faits pendant le glisser.
      setColumns(before);
      return;
    }
    const column = findColumn(columns, String(active.id));
    if (!column) return;

    const list = [...columns[column]];
    const fromIndex = list.findIndex((task) => task.id === active.id);
    const overIndex = list.findIndex((task) => task.id === over.id);
    if (overIndex !== -1 && overIndex !== fromIndex) {
      const [moved] = list.splice(fromIndex, 1);
      list.splice(overIndex, 0, moved);
    }
    const index = list.findIndex((task) => task.id === active.id);
    const position = computePosition(list[index - 1]?.position, list[index + 1]?.position);

    list[index] = { ...list[index], position, status: column };
    setColumns((current) => ({ ...current, [column]: list }));

    setInflight((count) => count + 1);
    startTransition(async () => {
      try {
        const result = await moveTask(String(active.id), column, position);
        if (!result.ok) {
          toast.error(result.error);
          setColumns(before); // la carte revient là où elle était
        }
      } finally {
        setInflight((count) => count - 1);
      }
    });
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      onDragCancel={() => {
        setActiveId(null);
        snapshot.current = null;
        setColumns(toColumns(tasks));
      }}
    >
      <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto px-6 pb-6 scroll-thin">
        {TASK_STATUSES.map((status) => (
          <Column key={status.value} status={status.value} label={status.label} tasks={columns[status.value]} projectId={projectId} projectKey={projectKey} />
        ))}
      </div>
      <DragOverlay dropAnimation={{ duration: 160, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }}>
        {activeTask ? <TaskCard task={activeTask} projectKey={projectKey} dragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function Column({
  status,
  label,
  tasks,
  projectId,
  projectKey,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskCardData[];
  projectId: string;
  projectKey: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [adding, setAdding] = useState(false);

  return (
    <section
      aria-label={label}
      className={cn(
        "flex w-[296px] shrink-0 flex-col rounded-xl bg-sunken/70 transition-colors",
        isOver && "bg-accent-soft/60",
        status === "WAITING_CLIENT" && "bg-[color-mix(in_srgb,var(--st-waiting)_7%,var(--sunken))]",
      )}
    >
      <header className="flex items-center gap-2 px-3 pb-2 pt-3">
        <StatusIcon status={status} />
        <h3 className="text-[13px] font-semibold">{label}</h3>
        <span className="tabular text-[12px] text-muted">{tasks.length}</span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label={`Ajouter une tâche dans « ${label} »`}
          className="ml-auto rounded p-0.5 text-muted hover:bg-surface hover:text-ink"
        >
          <Plus className="size-4" />
        </button>
      </header>

      <SortableContext items={tasks.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scroll-thin">
          {adding && (
            <QuickAdd projectId={projectId} status={status} compact autoFocus onDone={() => setAdding(false)} />
          )}
          {tasks.map((task) => (
            <SortableCard key={task.id} task={task} projectKey={projectKey} />
          ))}
          {tasks.length === 0 && !adding && (
            <p className="mx-1 mt-1 rounded-lg border border-dashed border-line-strong px-3 py-5 text-center text-[12px] text-faint">
              Déposez une tâche ici
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task, projectKey }: { task: TaskCardData; projectKey: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(isDragging && "opacity-30")}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} projectKey={projectKey} />
    </div>
  );
}
