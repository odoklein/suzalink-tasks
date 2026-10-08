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
import { ChevronsLeft, Plus } from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { moveTask } from "@/app/actions/tasks";
import { StatusIcon } from "@/components/primitives";
import { QuickAdd } from "@/components/quick-add";
import { TaskCard } from "@/components/task-card";
import { IconButton } from "@/components/ui/button";
import { TASK_STATUSES } from "@/lib/constants";
import { computePosition } from "@/lib/position";
import { oldestWaitingDays } from "@/lib/waiting";
import type { TaskCard as TaskCardData } from "@/lib/types";
import { cn } from "@/lib/utils";

type Columns = Record<TaskStatus, TaskCardData[]>;

const DONE_PREVIEW = 7;

function toColumns(tasks: TaskCardData[]): Columns {
  const columns = Object.fromEntries(TASK_STATUSES.map((s) => [s.value, [] as TaskCardData[]])) as Columns;
  for (const task of tasks) columns[task.status].push(task);
  for (const key of Object.keys(columns) as TaskStatus[]) {
    columns[key].sort((a, b) => a.position - b.position);
  }
  // « Fait » : les plus récemment terminées d’abord (l’ordre manuel n’y a pas de sens).
  columns.DONE.sort((a, b) => doneTime(b) - doneTime(a));
  return columns;
}

const doneTime = (task: TaskCardData) => new Date(task.completedAt ?? task.updatedAt).getTime();

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

    // Réordonner à l’intérieur de « Fait » ne change rien : la colonne est triée par date.
    if (column === "DONE" && findColumn(toColumns(tasks), String(active.id)) === "DONE") return;

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
      {/* Téléphone : une colonne par écran, et des pastilles pour sauter de l’une à l’autre. */}
      <nav aria-label="Colonnes" className="mb-3 flex gap-1.5 overflow-x-auto px-4 md:hidden">
        {TASK_STATUSES.map((status) => (
          <button
            key={status.value}
            type="button"
            onClick={() =>
              document.getElementById(`colonne-${status.value}`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
            }
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink-2"
          >
            <StatusIcon status={status.value} size={12} />
            {status.short}
            <span className="tabular text-muted">{columns[status.value].length}</span>
          </button>
        ))}
      </nav>
      <div className="flex min-h-0 flex-1 snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-6 scroll-thin sm:px-8 md:snap-none">
        {TASK_STATUSES.map((status) => (
          <Column
            key={status.value}
            status={status.value}
            label={status.label}
            tasks={columns[status.value]}
            projectId={projectId}
            projectKey={projectKey}
            dragging={activeId !== null}
          />
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
  dragging,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskCardData[];
  projectId: string;
  projectKey: string;
  dragging: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const oldest = status === "WAITING_CLIENT" ? oldestWaitingDays(tasks) : 0;
  const [adding, setAdding] = useState(false);
  // « Fait » est replié par défaut en rail de 44 px ; déplié, il montre les 7 plus récentes.
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const isDone = status === "DONE";
  const visible = isDone && !showAll ? tasks.slice(0, DONE_PREVIEW) : tasks;

  if (isDone && !expanded) {
    return (
      <section id={`colonne-${status}`} aria-label={label} className="shrink-0 snap-center">
        <button
          ref={setNodeRef}
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label={`Afficher la colonne « ${label} » (${tasks.length})`}
          className={cn(
            "flex h-full min-h-40 w-11 flex-col items-center gap-2 rounded-lg bg-sunken py-3 text-ui font-semibold text-ink-2 transition-colors hover:bg-line",
            isOver && "ring-2 ring-inset ring-accent/40",
          )}
        >
          <StatusIcon status={status} />
          <span className="[writing-mode:vertical-rl]">{label}</span>
          <span className="tabular text-xs font-medium text-muted">{tasks.length}</span>
        </button>
      </section>
    );
  }

  return (
    <section
      id={`colonne-${status}`}
      aria-label={label}
      className={cn(
        "flex w-[85vw] shrink-0 snap-center flex-col rounded-lg bg-sunken transition-shadow sm:w-[272px]",
        status === "WAITING_CLIENT" && "bg-waiting-soft/60",
        isOver && "ring-2 ring-inset ring-accent/40",
      )}
    >
      <header className="sticky top-0 z-[1] flex items-center gap-2 rounded-t-lg px-3 pb-2 pt-3">
        <StatusIcon status={status} />
        <h3 className="text-ui font-semibold">{label}</h3>
        <span className="tabular text-xs text-muted">
          {tasks.length}
          {status === "WAITING_CLIENT" && tasks.length > 0 && (
            <span className={cn(oldest >= 5 && "font-semibold text-waiting-text")}> · la plus ancienne : {oldest} j</span>
          )}
        </span>
        <span className="ml-auto flex items-center">
          {isDone && (
            <IconButton label="Replier la colonne" size="sm" onClick={() => setExpanded(false)}>
              <ChevronsLeft className="size-4" />
            </IconButton>
          )}
          <IconButton label={`Ajouter une tâche dans « ${label} »`} size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-4" />
          </IconButton>
        </span>
      </header>

      <SortableContext items={visible.map((task) => task.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[80px] flex-1 flex-col gap-2 overflow-y-auto px-2 pb-2 scroll-thin">
          {adding && (
            <QuickAdd projectId={projectId} status={status} compact autoFocus onDone={() => setAdding(false)} />
          )}
          {visible.map((task) => (
            <SortableCard key={task.id} task={task} projectKey={projectKey} />
          ))}
          {visible.length < tasks.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mx-1 rounded-sm py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink"
            >
              Voir les {tasks.length - visible.length} autres
            </button>
          )}
          {tasks.length === 0 && !adding && (
            <p
              className={cn(
                "mx-1 mt-1 rounded-md px-3 py-5 text-center text-xs text-muted",
                dragging && "border border-dashed border-line-strong",
              )}
            >
              {dragging ? "Déposez une tâche ici" : "Aucune tâche"}
            </p>
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task, projectKey }: { task: TaskCardData; projectKey: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative",
        isDragging && "opacity-30",
        isOver && !isDragging && "before:absolute before:-top-[5px] before:inset-x-1 before:h-0.5 before:rounded-full before:bg-accent",
      )}
      {...attributes}
      {...listeners}
    >
      <TaskCard task={task} projectKey={projectKey} />
    </div>
  );
}
