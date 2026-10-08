"use client";

import type { Priority, TaskStatus } from "@prisma/client";
import { ArrowUpRight, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  addComment,
  deleteTask,
  getTaskDetail,
  updateTask,
  type TaskDetail,
  type TaskPatch,
} from "@/app/actions/tasks";
import { useApp } from "@/components/app-context";
import {
  Avatar,
  EmptyAvatar,
  PriorityIcon,
  ProjectTile,
  StatusIcon,
} from "@/components/primitives";
import { SelectMenu } from "@/components/select-menu";
import { PRIORITIES, PRIORITY_BY_VALUE, STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants";
import { cn, formatDateTime, timeAgo } from "@/lib/utils";
import { promptWaitingFor } from "@/lib/waiting-prompt";

const inputClass =
  "w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink-2 outline-none transition-colors placeholder:text-faint hover:bg-sunken focus:border-line focus:bg-surface";

export function TaskDrawer() {
  const { openTaskId, closeTask, team } = useApp();
  const [loaded, setLoaded] = useState<TaskDetail | null>(null);
  const [, startTransition] = useTransition();

  // Le détail affiché est celui de la tâche ouverte ; sinon on montre le squelette.
  const task = loaded && loaded.id === openTaskId ? loaded : null;
  const setTask = setLoaded;

  const load = useCallback(async (id: string) => {
    const detail = await getTaskDetail(id);
    setLoaded(detail);
  }, []);

  useEffect(() => {
    if (!openTaskId) return;
    let cancelled = false;
    getTaskDetail(openTaskId).then((detail) => {
      if (!cancelled) setLoaded(detail);
    });
    return () => {
      cancelled = true;
    };
  }, [openTaskId]);

  const loading = !task;

  useEffect(() => {
    if (!openTaskId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !(event.target as HTMLElement).closest("[role=listbox]")) closeTask();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openTaskId, closeTask]);

  if (!openTaskId) return null;

  const patch = (changes: TaskPatch) => {
    if (!task) return;
    setTask({ ...task, ...(changes as Partial<TaskDetail>) });
    startTransition(async () => {
      const result = await updateTask(task.id, changes);
      if ("error" in result && result.error) toast.error(result.error);
      else if (changes.status === "WAITING_CLIENT" && task.status !== "WAITING_CLIENT") {
        promptWaitingFor({ taskId: task.id, ref: `${task.project.key}-${task.number}` });
      }
      await load(task.id);
    });
  };

  const assignee = team.find((member) => member.id === task?.assigneeId) ?? null;

  return (
    <>
      <div className="animate-fade-in fixed inset-0 z-40 bg-[rgb(10_12_16/0.18)]" onMouseDown={closeTask} />
      <aside
        role="dialog"
        aria-label="Détail de la tâche"
        className="animate-slide-in fixed inset-y-0 right-0 z-50 flex w-full max-w-[560px] flex-col border-l border-line bg-surface shadow-pop"
      >
        {!task || loading ? (
          <DrawerSkeleton onClose={closeTask} />
        ) : (
          <>
            <header className="flex items-center gap-2.5 border-b border-line px-5 py-3">
              <ProjectTile color={task.project.color} label={task.project.key} size={20} />
              <Link
                href={`/projects/${task.project.slug}`}
                onClick={closeTask}
                className="flex items-center gap-1 text-[13px] text-muted hover:text-ink"
              >
                {task.project.name}
                <ArrowUpRight className="size-3" />
              </Link>
              <span className="font-mono text-[12px] text-faint">
                {task.project.key}-{task.number}
              </span>
              <div className="ml-auto flex items-center gap-1">
                <DeleteButton
                  onConfirm={() =>
                    startTransition(async () => {
                      await deleteTask(task.id);
                      toast.success(`${task.project.key}-${task.number} supprimée`);
                      closeTask();
                    })
                  }
                />
                <button type="button" onClick={closeTask} aria-label="Fermer" className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink">
                  <X className="size-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
              <div className="px-5 pt-5">
                <TitleField key={task.id} value={task.title} onSave={(title) => title !== task.title && patch({ title })} />
              </div>

              <dl className="mt-4 grid grid-cols-[112px_1fr] items-center gap-x-3 gap-y-1 px-5">
                <Prop label="Statut">
                  <SelectMenu<TaskStatus>
                    label="Statut"
                    value={task.status}
                    onChange={(status) => patch({ status })}
                    options={TASK_STATUSES.map((s) => ({ value: s.value, label: s.label, icon: <StatusIcon status={s.value} /> }))}
                    trigger={
                      <>
                        <StatusIcon status={task.status} />
                        {STATUS_BY_VALUE[task.status].label}
                      </>
                    }
                  />
                </Prop>
                <Prop label="Priorité">
                  <SelectMenu<Priority>
                    label="Priorité"
                    value={task.priority}
                    onChange={(priority) => patch({ priority })}
                    options={PRIORITIES.map((p) => ({ value: p.value, label: p.label, icon: <PriorityIcon priority={p.value} /> }))}
                    trigger={
                      <>
                        <PriorityIcon priority={task.priority} />
                        {PRIORITY_BY_VALUE[task.priority].label}
                      </>
                    }
                  />
                </Prop>
                <Prop label="Assignée à">
                  <SelectMenu<string>
                    label="Assigner"
                    searchable
                    value={task.assigneeId ?? "none"}
                    onChange={(id) => patch({ assigneeId: id === "none" ? null : id })}
                    options={[
                      { value: "none", label: "Personne", icon: <EmptyAvatar size={18} /> },
                      ...team.map((m) => ({ value: m.id, label: m.name, icon: <Avatar name={m.name} color={m.color} size={18} /> })),
                    ]}
                    trigger={
                      assignee ? (
                        <>
                          <Avatar name={assignee.name} color={assignee.color} size={18} />
                          {assignee.name}
                        </>
                      ) : (
                        <>
                          <EmptyAvatar size={18} />
                          <span className="text-faint">Personne</span>
                        </>
                      )
                    }
                  />
                </Prop>
                <Prop label="Échéance">
                  <input
                    type="date"
                    aria-label="Échéance"
                    defaultValue={task.dueDate ? new Date(task.dueDate).toISOString().slice(0, 10) : ""}
                    onChange={(event) => patch({ dueDate: event.target.value || null })}
                    className={cn(inputClass, "tabular w-auto")}
                  />
                </Prop>
                <Prop label="Page / zone">
                  <InlineInput value={task.zone ?? ""} placeholder="Homepage, Fiche produit…" onSave={(zone) => patch({ zone })} />
                </Prop>
                <Prop label="Source">
                  <InlineInput value={task.source ?? ""} placeholder="Retours du 06/10…" onSave={(source) => patch({ source })} />
                </Prop>
                <Prop label="Hors périmètre">
                  <label className="flex cursor-pointer items-center gap-2 px-1.5 py-1 text-[13px] text-ink-2">
                    <input
                      type="checkbox"
                      checked={task.billable}
                      onChange={(event) => patch({ billable: event.target.checked })}
                      className="size-4 accent-[var(--st-waiting)]"
                    />
                    {task.billable ? "À facturer en supplément" : "Non"}
                  </label>
                </Prop>
              </dl>

              <section className="mt-5 border-t border-line px-5 pt-4">
                <h3 className="mb-1.5 text-[12px] font-semibold uppercase tracking-wider text-faint">Description</h3>
                <DescriptionField
                  key={task.id}
                  value={task.description ?? ""}
                  onSave={(description) => description !== (task.description ?? "") && patch({ description })}
                />
              </section>

              <section className="mt-5 border-t border-line px-5 pb-6 pt-4">
                <h3 className="mb-3 text-[12px] font-semibold uppercase tracking-wider text-faint">
                  Commentaires {task.comments.length > 0 && <span className="tabular">({task.comments.length})</span>}
                </h3>
                <ol className="space-y-4">
                  {task.comments.map((comment) => (
                    <li key={comment.id} className="flex gap-3">
                      {comment.author ? <Avatar name={comment.author.name} color={comment.author.color} size={24} /> : <EmptyAvatar size={24} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-[12px] text-muted">
                          <span className="font-medium text-ink">{comment.author?.name ?? "Ancien membre"}</span> · {timeAgo(comment.createdAt)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-2">{comment.body}</p>
                      </div>
                    </li>
                  ))}
                </ol>
                <CommentComposer
                  onSubmit={async (body) => {
                    const result = await addComment(task.id, body);
                    if ("error" in result && result.error) {
                      toast.error(result.error);
                      return false;
                    }
                    await load(task.id);
                    return true;
                  }}
                />

                {task.activities.length > 0 && (
                  <div className="mt-6">
                    <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wider text-faint">Historique</h3>
                    <ol className="space-y-1.5 border-l border-line pl-3">
                      {task.activities.map((activity) => (
                        <li key={activity.id} className="text-[12px] text-muted">
                          <span className="text-ink-2">{activity.actor?.name ?? "Quelqu'un"}</span> {activity.message} ·{" "}
                          <time dateTime={new Date(activity.createdAt).toISOString()} title={formatDateTime(activity.createdAt)}>
                            {timeAgo(activity.createdAt)}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="mt-4 text-[11px] text-faint">
                  Créée {task.creator ? `par ${task.creator.name} ` : ""}le {formatDateTime(task.createdAt)}
                </p>
              </section>
            </div>
          </>
        )}
      </aside>
    </>
  );
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="py-1 text-[12px] text-muted">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

function TitleField({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [draft]);
  return (
    <textarea
      ref={ref}
      value={draft}
      rows={1}
      aria-label="Titre de la tâche"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onSave(draft.trim() || value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          (event.target as HTMLTextAreaElement).blur();
        }
      }}
      className="w-full resize-none bg-transparent font-display text-[21px] font-semibold leading-snug tracking-tight outline-none"
    />
  );
}

function InlineInput({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <input
      value={draft}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
      className={inputClass}
    />
  );
}

function DescriptionField({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <textarea
      value={draft}
      rows={Math.max(3, draft.split("\n").length)}
      placeholder="Ajouter le détail, le lien vers la maquette, le texte exact demandé par le client…"
      aria-label="Description"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onSave(draft)}
      className="w-full resize-none rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] leading-relaxed text-ink-2 outline-none placeholder:text-faint hover:bg-sunken focus:border-line focus:bg-surface"
    />
  );
}

function CommentComposer({ onSubmit }: { onSubmit: (body: string) => Promise<boolean> }) {
  const [body, setBody] = useState("");
  const [pending, startTransition] = useTransition();
  const send = () =>
    startTransition(async () => {
      if (await onSubmit(body)) setBody("");
    });
  return (
    <div className="mt-4 rounded-lg border border-line bg-surface-2 focus-within:border-accent">
      <textarea
        value={body}
        rows={2}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            send();
          }
        }}
        placeholder="Écrire un commentaire…"
        aria-label="Nouveau commentaire"
        className="w-full resize-none bg-transparent px-3 py-2 text-[13px] outline-none placeholder:text-faint"
      />
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="text-[11px] text-faint">Ctrl + Entrée pour envoyer</span>
        <button
          type="button"
          disabled={pending || !body.trim()}
          onClick={send}
          className="rounded-md bg-ink px-2.5 py-1 text-[12px] font-semibold text-bg disabled:opacity-40"
        >
          Commenter
        </button>
      </div>
    </div>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);
  return armed ? (
    <button type="button" onClick={onConfirm} className="rounded-md bg-danger px-2 py-1 text-[12px] font-semibold text-white">
      Confirmer la suppression
    </button>
  ) : (
    <button type="button" onClick={() => setArmed(true)} aria-label="Supprimer la tâche" className="rounded-md p-1.5 text-muted hover:bg-danger-soft hover:text-danger">
      <Trash2 className="size-4" />
    </button>
  );
}

function DrawerSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-5">
      <div className="flex justify-end">
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 text-muted hover:bg-sunken">
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-2 h-7 w-3/4 animate-pulse rounded-md bg-sunken" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="h-5 animate-pulse rounded bg-sunken" style={{ width: `${55 + ((index * 13) % 35)}%` }} />
        ))}
      </div>
    </div>
  );
}
