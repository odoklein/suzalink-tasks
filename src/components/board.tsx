"use client";

import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
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
import { useAnnounce } from "@/components/announcer";
import { StatusIcon } from "@/components/primitives";
import { QuickAdd } from "@/components/quick-add";
import { TaskCard } from "@/components/task-card";
import { IconButton } from "@/components/ui/button";
import { STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants";
import { computePosition } from "@/lib/position";
import { useArrivals } from "@/lib/use-arrivals";
import { useReducedMotion } from "@/lib/use-reduced-motion";
import { oldestWaitingDays } from "@/lib/waiting";
import type { TaskCard as TaskCardData } from "@/lib/types";
import { cn } from "@/lib/utils";
import { promptWaitingFor } from "@/lib/waiting-prompt";

type Columns = Record<TaskStatus, TaskCardData[]>;

const DONE_PREVIEW = 7;
// Même courbe que --ease-out (globals.css) : dnd-kit anime en JS et ne lit pas les variables CSS.
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";

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
  const reduceMotion = useReducedMotion();
  // Une tâche qui change de colonne ailleurs que par glisser (tiroir, liste, palette) apparaît avec un fondu.
  const arrived = useArrivals(
    Object.values(columns)
      .flat()
      .map((task) => ({ id: task.id, key: task.status })),
    activeId === null && inflight === 0,
  );

  // Les données serveur font foi dès qu'elles changent (après chaque action) :
  // on resynchronise pendant le rendu plutôt que dans un effet. Pendant un glisser, ou tant qu'un
  // déplacement est en cours d'enregistrement, la resynchronisation attend (elle sera appliquée
  // ensuite, avec les données les plus récentes) pour ne pas faire sauter la carte sous le curseur.
  if (syncedTasks !== tasks && activeId === null && inflight === 0) {
    setSyncedTasks(tasks);
    setColumns(toColumns(tasks));
  }

  const announce = useAnnounce();

  // Souris et toucher sont deux capteurs : au doigt, le glisser démarre après un appui court, pour
  // que le défilement de la colonne et de la page reste possible. Espace lève, Entrée ouvre la tâche.
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
      keyboardCodes: { start: ["Space"], cancel: ["Escape"], end: ["Space"] },
    }),
  );

  const refOf = (id: string | number) => {
    const task = Object.values(columns).flat().find((candidate) => candidate.id === String(id));
    return task ? `${projectKey}-${task.number}` : "La tâche";
  };
  const where = (id: string | number) => {
    const column = findColumn(columns, String(id));
    if (!column) return "";
    const index = columns[column].findIndex((task) => task.id === String(id));
    const place = index === -1 ? "" : `, position ${index + 1} sur ${columns[column].length}`;
    return `« ${STATUS_BY_VALUE[column].label} »${place}`;
  };
  const announcements: Announcements = {
    onDragStart: ({ active }) => `${refOf(active.id)} saisie. ${where(active.id)}.`,
    onDragOver: ({ active, over }) => (over ? `${refOf(active.id)} au-dessus de ${where(over.id) || "la colonne"}.` : undefined),
    onDragEnd: ({ active, over }) => {
      if (!over) return `${refOf(active.id)} remise à sa place.`;
      // Le réordonnancement dans une même colonne n’est appliqué qu’au dépôt : la position finale est celle de la cible.
      return `${refOf(active.id)} déplacée dans ${where(over.id !== active.id && findColumn(columns, String(over.id)) === findColumn(columns, String(active.id)) ? over.id : active.id)}.`;
    },
    onDragCancel: ({ active }) => `Déplacement de ${refOf(active.id)} annulé.`,
  };

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
    if (column === "DONE") {
      // « Fait » est trié par date, les plus récentes d’abord : la carte déposée prend la tête, comme
      // après la resynchronisation serveur, au lieu de sauter en haut sans transition.
      const [moved] = list.splice(fromIndex, 1);
      list.unshift(moved);
    } else if (overIndex !== -1 && overIndex !== fromIndex) {
      const [moved] = list.splice(fromIndex, 1);
      list.splice(overIndex, 0, moved);
    }
    const index = list.findIndex((task) => task.id === active.id);
    const position = computePosition(list[index - 1]?.position, list[index + 1]?.position);

    list[index] = { ...list[index], position, status: column };
    setColumns((current) => ({ ...current, [column]: list }));
    saveMove(String(active.id), column, position, before);
  };

  // Enregistre un déplacement déjà appliqué à l’écran ; en cas de refus, la carte revient où elle était.
  const saveMove = (taskId: string, column: TaskStatus, position: number, before: Columns) => {
    const taskBefore = tasks.find((task) => task.id === taskId);
    setInflight((count) => count + 1);
    startTransition(async () => {
      try {
        const result = await moveTask(taskId, column, position);
        if (!result.ok) {
          toast.error(result.error);
          setColumns(before);
        } else if (taskBefore && column === "WAITING_CLIENT" && taskBefore.status !== "WAITING_CLIENT") {
          promptWaitingFor({ taskId: taskBefore.id, ref: `${projectKey}-${taskBefore.number}` });
        }
      } finally {
        setInflight((count) => count - 1);
      }
    });
  };

  // « Déplacer vers… » : le déplacement sans glisser. La carte prend la fin de la colonne cible
  // (la tête de « Fait », triée par date), comme le serveur la classera.
  const moveToColumn = (taskId: string, to: TaskStatus) => {
    const from = findColumn(columns, taskId);
    const moving = from && columns[from].find((task) => task.id === taskId);
    if (!from || !moving || from === to) return;
    const target = columns[to];
    const position = to === "DONE" ? computePosition(undefined, target[0]?.position) : computePosition(target[target.length - 1]?.position);
    const moved = { ...moving, position, status: to };
    const before = columns;
    setColumns({
      ...columns,
      [from]: columns[from].filter((task) => task.id !== taskId),
      [to]: to === "DONE" ? [moved, ...target] : [...target, moved],
    });
    announce(`${projectKey}-${moving.number} déplacée dans « ${STATUS_BY_VALUE[to].label} ».`);
    saveMove(taskId, to, position, before);
  };

  return (
    <DndContext
      sensors={sensors}
      accessibility={{
        announcements,
        screenReaderInstructions: {
          draggable:
            "Appuyez sur Espace pour saisir la tâche, sur les flèches pour la déplacer, sur Espace pour la déposer, sur Échap pour annuler. Entrée ouvre la tâche.",
        },
      }}
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
              document.getElementById(`colonne-${status.value}`)?.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", inline: "center", block: "nearest" })
            }
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-ink-2"
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
            arrived={arrived}
            onMove={moveToColumn}
          />
        ))}
      </div>
      <DragOverlay dropAnimation={reduceMotion ? null : { duration: 180, easing: EASE_OUT }}>
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
  arrived,
  onMove,
}: {
  status: TaskStatus;
  label: string;
  tasks: TaskCardData[];
  projectId: string;
  projectKey: string;
  dragging: boolean;
  arrived: ReadonlySet<string>;
  onMove: (taskId: string, to: TaskStatus) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const oldest = status === "WAITING_CLIENT" ? oldestWaitingDays(tasks) : 0;
  const [adding, setAdding] = useState(false);
  // « Fait » est replié par défaut en rail de 44 px ; déplié, il montre les 7 plus récentes.
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const isDone = status === "DONE";
  const visible = isDone && !showAll ? tasks.slice(0, DONE_PREVIEW) : tasks;

  // Une tâche tombe dans « Fait » replié : le rail n’a pas de carte où atterrir, il prend un instant
  // la teinte du statut (la clé relance l’animation à chaque arrivée). Pendant un glisser, le compte
  // reste celui du départ : le signal part au dépôt, pas quand le curseur survole le rail.
  const [seenCount, setSeenCount] = useState(tasks.length);
  const [landings, setLandings] = useState(0);
  if (!dragging && seenCount !== tasks.length) {
    setSeenCount(tasks.length);
    if (tasks.length > seenCount) setLandings((count) => count + 1);
  }

  if (isDone && !expanded) {
    return (
      <section id={`colonne-${status}`} aria-label={label} className="shrink-0 snap-center">
        <button
          key={landings}
          ref={setNodeRef}
          type="button"
          onClick={() => setExpanded(true)}
          aria-expanded={false}
          aria-label={`Afficher la colonne « ${label} » (${tasks.length})`}
          className={cn(
            "flex h-full min-h-40 w-11 flex-col items-center gap-2 rounded-lg bg-sunken py-3 text-ui font-semibold text-ink-2 transition-[background-color,box-shadow] hover:bg-line",
            landings > 0 && "animate-landed",
            isOver && "ring-2 ring-inset ring-accent/80",
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
        isOver && "ring-2 ring-inset ring-accent/80",
      )}
    >
      <header className="sticky top-0 z-[1] flex items-center gap-2 rounded-t-lg px-3 pb-2 pt-3">
        <StatusIcon status={status} />
        <h3 className="text-ui font-semibold">{label}</h3>
        <span className="tabular text-xs text-muted">
          {tasks.length}
          {status === "WAITING_CLIENT" && tasks.length > 0 && (
            <span className={cn(oldest >= 5 && "font-semibold text-waiting-text")}> · la plus ancienne : {oldest} j</span>
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
            <SortableCard key={task.id} task={task} projectKey={projectKey} arrived={arrived.has(task.id)} onMove={onMove} />
          ))}
          {visible.length < tasks.length && (
            <button
              type="button"
              onClick={() => setShowAll(true)}
              className="mx-1 rounded-sm py-1.5 text-xs font-medium text-muted hover:bg-surface hover:text-ink pointer-coarse:min-h-11"
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

function SortableCard({
  task,
  projectKey,
  arrived,
  onMove,
}: {
  task: TaskCardData;
  projectKey: string;
  arrived: boolean;
  onMove: (taskId: string, to: TaskStatus) => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: task.id,
    // Les cartes voisines glissent avec la même durée et la même courbe que le reste de l’interface.
    transition: { duration: 180, easing: EASE_OUT },
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn(
        "relative",
        isDragging && "opacity-30",
        isOver && !isDragging && "before:absolute before:-top-[5px] before:inset-x-1 before:h-0.5 before:rounded-full before:bg-accent",
      )}
    >
      <TaskCard
        task={task}
        projectKey={projectKey}
        className={arrived ? "animate-arrive" : undefined}
        // La carte entière est la poignée : un seul élément focusable, Espace lève, Entrée ouvre.
        handle={{ ref: setActivatorNodeRef, props: { ...attributes, ...listeners } as React.HTMLAttributes<HTMLElement> }}
        onMove={(status) => onMove(task.id, status)}
      />
    </div>
  );
}
