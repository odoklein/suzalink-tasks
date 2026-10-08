"use client";

import type { Priority, TaskStatus } from "@prisma/client";
import { ArrowUpRight, Hash, Link2, Trash2, X } from "lucide-react";
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
  AgeChip,
  Avatar,
  EmptyAvatar,
  PriorityIcon,
  ProjectTile,
  StatusIcon,
} from "@/components/primitives";
import { SelectMenu } from "@/components/select-menu";
import { Button, IconButton } from "@/components/ui/button";
import { Switch } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input, Textarea } from "@/components/ui/input";
import { SectionHeader } from "@/components/ui/section-header";
import { Skeleton, SkeletonLine } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/tooltip";
import { PRIORITIES, PRIORITY_BY_VALUE, STATUS_BY_VALUE, TASK_STATUSES } from "@/lib/constants";
import { rememberTask } from "@/lib/recent-tasks";
import { taskPath } from "@/lib/task-ref";
import { toParisDateInput } from "@/lib/time";
import { formatDateTime, timeAgo } from "@/lib/utils";

export function TaskDrawer() {
  const { openTaskId, openTaskRef, closeTask, team } = useApp();
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
      if (cancelled) return;
      setLoaded(detail);
      if (detail) rememberTask({ id: detail.id, ref: `${detail.project.key}-${detail.number}`, title: detail.title });
    });
    return () => {
      cancelled = true;
    };
  }, [openTaskId]);

  const loading = !task;

  useEffect(() => {
    if (!openTaskRef) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !(event.target as HTMLElement).closest("[role=listbox]")) closeTask();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openTaskRef, closeTask]);

  // Le tiroir s’affiche dès que l’URL porte ?tache= ; le squelette couvre la résolution.
  if (!openTaskRef) return null;

  const patch = (changes: TaskPatch) => {
    if (!task) return;
    setTask({ ...task, ...(changes as Partial<TaskDetail>) });
    startTransition(async () => {
      const result = await updateTask(task.id, changes);
      if ("error" in result && result.error) toast.error(result.error);
      await load(task.id);
    });
  };

  const assignee = team.find((member) => member.id === task?.assigneeId) ?? null;

  return (
    <>
      <div className="animate-fade-in fixed inset-0 z-drawer bg-[var(--scrim)]" onMouseDown={closeTask} />
      <aside
        role="dialog"
        aria-label="Détail de la tâche"
        className="animate-slide-in fixed inset-y-0 right-0 z-drawer flex w-full max-w-[var(--drawer-w)] flex-col border-l border-line bg-surface shadow-overlay"
      >
        {!task || loading ? (
          <DrawerSkeleton onClose={closeTask} />
        ) : (
          <>
            <header className="flex items-center gap-2.5 border-b border-line px-5 py-3">
              <ProjectTile color={task.project.color} label={task.project.key} size={20} />
              {/* Sans ?tache=, la page du projet ferme d’elle-même le tiroir. */}
              <Link
                href={`/projects/${task.project.slug}`}
                className="flex items-center gap-1 text-ui text-muted hover:text-ink"
              >
                {task.project.name}
                <ArrowUpRight className="size-3" />
              </Link>
              <span className="font-mono text-xs text-muted">
                {task.project.key}-{task.number}
              </span>
              {task.status === "WAITING_CLIENT" && <AgeChip since={task.statusChangedAt} />}
              <div className="ml-auto flex items-center gap-1">
                <IconButton label="Copier le lien" onClick={() => copy(`${window.location.origin}${taskPath(`${task.project.key}-${task.number}`)}`, "Lien copié")}>
                  <Link2 className="size-4" />
                </IconButton>
                <IconButton label="Copier la référence" onClick={() => copy(`${task.project.key}-${task.number}`, "Référence copiée")}>
                  <Hash className="size-4" />
                </IconButton>
                <DeleteButton
                  onConfirm={() =>
                    startTransition(async () => {
                      await deleteTask(task.id);
                      toast.success(`${task.project.key}-${task.number} supprimée`);
                      closeTask();
                    })
                  }
                />
                <IconButton label="Fermer" onClick={closeTask}>
                  <X className="size-4" />
                </IconButton>
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
                          <span className="text-muted">Personne</span>
                        </>
                      )
                    }
                  />
                </Prop>
                <Prop label="Échéance">
                  <DatePicker
                    label="Échéance"
                    value={task.dueDate ? toParisDateInput(task.dueDate) : null}
                    onChange={(dueDate) => patch({ dueDate })}
                    className="border-transparent bg-transparent hover:bg-sunken"
                  />
                </Prop>
                <Prop label="Page / zone">
                  <InlineInput value={task.zone ?? ""} placeholder="Homepage, Fiche produit…" onSave={(zone) => patch({ zone })} />
                </Prop>
                <Prop label="Source">
                  <InlineInput value={task.source ?? ""} placeholder="Retours du 06/10…" onSave={(source) => patch({ source })} />
                </Prop>
                <Prop label="Hors périmètre">
                  <Switch
                    className="px-1.5 py-1"
                    checked={task.billable}
                    onChange={(event) => patch({ billable: event.target.checked })}
                    label={task.billable ? "À facturer en supplément" : "Non"}
                  />
                </Prop>
              </dl>

              <section className="mt-5 border-t border-line px-5 pt-4">
                <SectionHeader as="h3" title="Description" className="mb-1.5" />
                <DescriptionField
                  key={task.id}
                  value={task.description ?? ""}
                  onSave={(description) => description !== (task.description ?? "") && patch({ description })}
                />
              </section>

              <section className="mt-5 border-t border-line px-5 pb-6 pt-4">
                <SectionHeader as="h3" title="Commentaires" count={task.comments.length || undefined} className="mb-3" />
                <ol className="space-y-4">
                  {task.comments.map((comment) => (
                    <li key={comment.id} className="flex gap-3">
                      {comment.author ? <Avatar name={comment.author.name} color={comment.author.color} size={24} /> : <EmptyAvatar size={24} />}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-muted">
                          <span className="font-medium text-ink">{comment.author?.name ?? "Ancien membre"}</span> · {timeAgo(comment.createdAt)}
                        </p>
                        <p className="mt-0.5 whitespace-pre-wrap text-ui leading-relaxed text-ink-2">{comment.body}</p>
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
                    <SectionHeader as="h3" title="Historique" />
                    <ol className="space-y-1.5 border-l border-line pl-3">
                      {task.activities.map((activity) => (
                        <li key={activity.id} className="text-xs text-muted">
                          <span className="text-ink-2">{activity.actor?.name ?? "Quelqu'un"}</span> {activity.message} ·{" "}
                          <Tooltip content={formatDateTime(activity.createdAt)}>
                            <time dateTime={new Date(activity.createdAt).toISOString()}>{timeAgo(activity.createdAt)}</time>
                          </Tooltip>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
                <p className="mt-4 text-meta text-muted">
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

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error("Copie impossible : sélectionnez le texte et copiez-le à la main.");
  }
}

function Prop({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="py-1 text-xs text-muted">{label}</dt>
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
      className="w-full resize-none bg-transparent text-h2 font-semibold leading-snug tracking-[-0.01em] outline-none"
    />
  );
}

function InlineInput({ value, placeholder, onSave }: { value: string; placeholder: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      variant="inline"
      value={draft}
      placeholder={placeholder}
      aria-label={placeholder}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(event) => event.key === "Enter" && (event.target as HTMLInputElement).blur()}
    />
  );
}

function DescriptionField({ value, onSave }: { value: string; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  return (
    <Textarea
      variant="inline"
      value={draft}
      rows={Math.max(3, draft.split("\n").length)}
      placeholder="Ajouter le détail, le lien vers la maquette, le texte exact demandé par le client…"
      aria-label="Description"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onSave(draft)}
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
    <div className="mt-4 rounded-md border border-line bg-surface-2 focus-within:border-accent focus-within:shadow-[var(--ring)]">
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
        className="w-full resize-none bg-transparent px-3 py-2 text-ui outline-hidden placeholder:text-faint"
      />
      <div className="flex items-center justify-between px-3 pb-2">
        <span className="text-meta text-muted">Ctrl + Entrée pour envoyer</span>
        <Button variant="primary" size="sm" loading={pending} disabled={!body.trim()} onClick={send}>
          Commenter
        </Button>
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
  // Un seul bouton : il change de libellé et de ton au premier clic, sans bouger de place.
  return (
    <Button
      variant={armed ? "danger" : "ghost"}
      size={armed ? "sm" : "icon"}
      aria-label={armed ? "Confirmer la suppression" : "Supprimer la tâche"}
      onClick={() => (armed ? onConfirm() : setArmed(true))}
      className={armed ? "w-44" : "size-7 text-muted hover:bg-danger-soft hover:text-danger-text"}
    >
      {armed ? "Confirmer la suppression" : <Trash2 className="size-4" />}
    </Button>
  );
}

function DrawerSkeleton({ onClose }: { onClose: () => void }) {
  return (
    <div className="p-5">
      <div className="flex justify-end">
        <IconButton label="Fermer" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>
      <Skeleton className="mt-2 h-7 w-3/4" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 6 }, (_, index) => (
          <SkeletonLine key={index} className="h-5" width={`${55 + ((index * 13) % 35)}%`} />
        ))}
      </div>
    </div>
  );
}
