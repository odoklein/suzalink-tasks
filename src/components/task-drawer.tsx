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
import { parseEuros } from "@/lib/extras";
import { promptWaitingFor } from "@/lib/waiting-prompt";
import { DESCRIPTION_MAX, TITLE_MAX } from "@/lib/validate";

/**
 * Ce que le tiroir sait de la tâche `id` : détail chargé, tâche disparue, ou échec de chargement.
 * Sans entrée pour la tâche ouverte, l'état est « loading » (squelette).
 */
type DrawerData =
  | { id: string; status: "ready"; task: TaskDetail }
  | { id: string; status: "missing" }
  | { id: string; status: "error" };

export function TaskDrawer() {
  const { openTaskId, openTaskRef, closeTask, team } = useApp();
  const [data, setData] = useState<DrawerData | null>(null);
  const [, startTransition] = useTransition();
  // Brouillons du titre et de la description : ils survivent au démontage des champs
  // (Échap, clic sur le fond…) et sont envoyés par `flushDrafts` avant la fermeture.
  const drafts = useRef<{ title?: string; description?: string }>({});
  const latestTask = useRef<TaskDetail | null>(null);
  const loadSeq = useRef(0);

  // Le détail affiché est celui de la tâche ouverte ; sinon on montre le squelette.
  const current = data && data.id === openTaskId ? data : null;
  const status = !current ? "loading" : current.status;
  const task = current?.status === "ready" ? current.task : null;

  useEffect(() => {
    latestTask.current = task;
  });

  /**
   * Charge le détail. `background` : rechargement après une modification, un échec réseau ne doit pas
   * remplacer par une erreur un détail déjà affiché (mais une tâche supprimée entre-temps passe bien en « supprimée »).
   */
  const load = useCallback(async (id: string, background = false) => {
    const seq = ++loadSeq.current;
    let next: DrawerData | null;
    try {
      const detail = await getTaskDetail(id);
      if (detail === null) next = { id, status: "missing" };
      else if ("error" in detail) next = background ? null : { id, status: "error" };
      else {
        next = { id, status: "ready", task: detail };
        rememberTask({ id: detail.id, ref: `${detail.project.key}-${detail.number}`, title: detail.title });
      }
    } catch {
      next = background ? null : { id, status: "error" };
    }
    // Une réponse plus ancienne que la dernière demande ne doit jamais écraser les données.
    if (seq !== loadSeq.current || !next) return;
    setData(next);
  }, []);

  useEffect(() => {
    if (openTaskId) void load(openTaskId);
  }, [openTaskId, load]);

  const retry = () => {
    if (!openTaskId) return;
    setData(null); // retour au squelette pendant le nouvel essai
    void load(openTaskId);
  };

  const sendPatch = useCallback(
    (target: TaskDetail, changes: TaskPatch, detached = false) => {
      // `detached` : le tiroir se ferme ou change de tâche, on n'y touche plus (ni mise à jour
      // optimiste ni rechargement) ; sinon une réponse tardive écraserait la tâche affichée.
      if (!detached) setData({ id: target.id, status: "ready", task: { ...target, ...(changes as Partial<TaskDetail>) } });
      startTransition(async () => {
        const result = await updateTask(target.id, changes);
        if (!result.ok) toast.error(result.error);
        else if (changes.status === "WAITING_CLIENT" && target.status !== "WAITING_CLIENT") {
          promptWaitingFor({ taskId: target.id, ref: `${target.project.key}-${target.number}` });
        }
        if (!detached) await load(target.id, true);
      });
    },
    [load],
  );

  /** Envoie le titre et la description tapés mais pas encore enregistrés (le blur n'a pas eu lieu). */
  const flushDrafts = useCallback(() => {
    const current = latestTask.current;
    const pending = drafts.current;
    drafts.current = {};
    if (!current) return;
    const changes: TaskPatch = {};
    const title = pending.title?.trim();
    if (title && title !== current.title) changes.title = title;
    if (pending.description !== undefined && pending.description.trim() !== (current.description ?? "").trim()) {
      changes.description = pending.description;
    }
    if (Object.keys(changes).length > 0) sendPatch(current, changes, true);
  }, [sendPatch]);

  const requestClose = useCallback(() => {
    flushDrafts();
    closeTask();
  }, [flushDrafts, closeTask]);

  // Filet de sécurité : si le tiroir change de tâche ou se ferme autrement (palette, lien…),
  // les brouillons de la tâche précédente partent quand même.
  useEffect(() => flushDrafts, [openTaskId, flushDrafts]);

  useEffect(() => {
    if (!openTaskRef) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !(event.target as HTMLElement).closest("[role=listbox],[data-select-menu]")) requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openTaskRef, requestClose]);

  // Le tiroir s’affiche dès que l’URL porte ?tache= ; le squelette couvre la résolution.
  if (!openTaskRef) return null;

  const patch = (changes: TaskPatch) => {
    if (task) sendPatch(task, changes);
  };

  const assignee = team.find((member) => member.id === task?.assigneeId) ?? null;

  return (
    <>
      <div className="animate-fade-in fixed inset-0 z-drawer bg-[var(--scrim)]" onMouseDown={requestClose} />
      <aside
        role="dialog"
        aria-label="Détail de la tâche"
        className="animate-slide-in fixed inset-y-0 right-0 z-drawer flex w-full max-w-[var(--drawer-w)] flex-col border-l border-line bg-surface shadow-overlay"
      >
        {status === "missing" ? (
          <DrawerMessage title="Cette tâche a été supprimée." onClose={requestClose} />
        ) : status === "error" ? (
          <DrawerMessage title="Impossible de charger la tâche." onClose={requestClose} onRetry={retry} />
        ) : !task ? (
          <DrawerSkeleton onClose={requestClose} />
        ) : (
          <>
            <header className="flex items-center gap-2.5 border-b border-line px-5 py-3">
              <ProjectTile color={task.project.color} label={task.project.key} size={20} />
              {/* Sans ?tache=, la page du projet ferme d’elle-même le tiroir. */}
              <Link
                href={`/projects/${task.project.slug}`}
                onClick={requestClose}
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
                      const result = await deleteTask(task.id);
                      if (!result.ok) {
                        toast.error(result.error);
                        return;
                      }
                      toast.success(`${task.project.key}-${task.number} supprimée`);
                      drafts.current = {};
                      closeTask();
                    })
                  }
                />
                <IconButton label="Fermer" onClick={requestClose}>
                  <X className="size-4" />
                </IconButton>
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
              <div className="px-5 pt-5">
                <TitleField
                  key={task.id}
                  value={task.title}
                  onDraft={(title) => (drafts.current.title = title)}
                  onSave={(title) => title !== task.title && patch({ title })}
                />
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
                <Prop label="Attribuée à">
                  <SelectMenu<string>
                    label="Attribuer"
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
                <Prop label="Hors périmètre (€)">
                  <Switch
                    className="px-1.5 py-1"
                    checked={task.billable}
                    onChange={(event) => patch({ billable: event.target.checked })}
                    label={task.billable ? "À facturer en supplément" : "Non"}
                  />
                </Prop>
                {task.billable && (
                  <>
                    <Prop label="Montant estimé">
                      <InlineInput
                        value={task.estimatedAmountCents !== null ? String(task.estimatedAmountCents / 100).replace(".", ",") : ""}
                        placeholder="150 (€ HT)"
                        onSave={(value) => {
                          const cents = parseEuros(value);
                          if (value.trim() && cents === null) {
                            toast.error("Montant illisible : écrivez par exemple 150 ou 150,50.");
                            return;
                          }
                          patch({ estimatedAmountCents: cents });
                        }}
                      />
                    </Prop>
                    <Prop label="Note de facturation">
                      <InlineInput value={task.billingNote ?? ""} placeholder="Demandé par Luna le 06/10…" onSave={(billingNote) => patch({ billingNote })} />
                    </Prop>
                  </>
                )}
              </dl>

              <section className="mt-5 border-t border-line px-5 pt-4">
                <SectionHeader as="h3" title="Description" className="mb-1.5" />
                <DescriptionField
                  key={task.id}
                  value={task.description ?? ""}
                  onDraft={(description) => (drafts.current.description = description)}
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
                  key={task.id}
                  taskId={task.id}
                  onSubmit={async (body) => {
                    const result = await addComment(task.id, body);
                    if (!result.ok) {
                      toast.error(result.error);
                      return false;
                    }
                    await load(task.id, true);
                    return true;
                  }}
                />

                {task.activities.length > 0 && (
                  <div className="mt-6">
                    <SectionHeader as="h3" title="Historique" />
                    <ol className="space-y-1.5 border-l border-line pl-3">
                      {task.activities.map((activity) => (
                        <li key={activity.id} className="text-xs text-muted">
                          <span className="text-ink-2">{activity.actor?.name ?? "Quelqu’un"}</span> {activity.message} ·{" "}
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

function TitleField({
  value,
  onSave,
  onDraft,
}: {
  value: string;
  onSave: (value: string) => void;
  onDraft: (value: string) => void;
}) {
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
      maxLength={TITLE_MAX}
      onChange={(event) => {
        setDraft(event.target.value);
        onDraft(event.target.value);
      }}
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

function DescriptionField({
  value,
  onSave,
  onDraft,
}: {
  value: string;
  onSave: (value: string) => void;
  onDraft: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Textarea
      variant="inline"
      value={draft}
      rows={Math.max(3, draft.split("\n").length)}
      placeholder="Ajouter le détail, le lien vers la maquette, le texte exact demandé par le client…"
      aria-label="Description"
      maxLength={DESCRIPTION_MAX}
      onChange={(event) => {
        setDraft(event.target.value);
        onDraft(event.target.value);
      }}
      onBlur={() => onSave(draft)}
    />
  );
}

/** Commentaire en cours de frappe, conservé par tâche le temps de la session (fermeture accidentelle du tiroir). */
const commentDraftKey = (taskId: string) => `draft-comment:${taskId}`;

function readCommentDraft(taskId: string) {
  try {
    return sessionStorage.getItem(commentDraftKey(taskId)) ?? "";
  } catch {
    return "";
  }
}

function writeCommentDraft(taskId: string, body: string) {
  try {
    if (body) sessionStorage.setItem(commentDraftKey(taskId), body);
    else sessionStorage.removeItem(commentDraftKey(taskId));
  } catch {
    // stockage indisponible (navigation privée) : le brouillon ne survivra pas, sans gravité
  }
}

function CommentComposer({ taskId, onSubmit }: { taskId: string; onSubmit: (body: string) => Promise<boolean> }) {
  const [body, setBody] = useState(() => readCommentDraft(taskId));
  const [pending, startTransition] = useTransition();
  const update = (next: string) => {
    setBody(next);
    writeCommentDraft(taskId, next);
  };
  const send = () =>
    startTransition(async () => {
      if (await onSubmit(body)) update("");
    });
  return (
    <div className="mt-4 rounded-md border border-line bg-surface-2 focus-within:border-accent focus-within:shadow-[var(--ring)]">
      <textarea
        value={body}
        rows={2}
        onChange={(event) => update(event.target.value)}
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

function DrawerMessage({ title, onClose, onRetry }: { title: string; onClose: () => void; onRetry?: () => void }) {
  return (
    <div className="flex h-full flex-col p-5">
      <div className="flex justify-end">
        <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1.5 text-muted hover:bg-sunken">
          <X className="size-4" />
        </button>
      </div>
      <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-4 pb-16 text-center">
        <p className="font-display text-[17px] font-semibold">{title}</p>
        <div className="flex gap-2">
          {onRetry && (
            <button type="button" onClick={onRetry} className="rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg hover:opacity-90">
              Réessayer
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 hover:border-line-strong hover:text-ink"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
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
