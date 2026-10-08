"use client";

import type { ProjectType } from "@prisma/client";
import { Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { deleteTemplate, saveTemplate, type TemplateInput } from "@/app/actions/templates";
import { fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { parseTemplateTasks, PROJECT_TYPES } from "@/lib/templates";
import { cn } from "@/lib/utils";

type Editable = TemplateInput & { id: string };

const EMPTY: TemplateInput = { name: "", type: "OTHER", milestones: "", zones: "", tasks: "" };

/** Carte d'un modèle de projet, repliée par défaut ; `template` null : création. */
export function TemplateEditor({ template }: { template: Editable | null }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TemplateInput>(template ?? EMPTY);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();
  const id = template?.id ?? "new";
  const set = (patch: Partial<TemplateInput>) => setForm((current) => ({ ...current, ...patch }));
  const taskCount = parseTemplateTasks(form.tasks).length;

  if (!open) {
    return template ? (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-4 text-left shadow-card hover:border-line-strong"
      >
        <span className="font-medium">{template.name}</span>
        <span className="text-[12px] text-muted">{PROJECT_TYPES.find((t) => t.value === template.type)?.label}</span>
        <span className="ml-auto text-[12px] text-muted">{taskCount} tâches · Modifier</span>
      </button>
    ) : (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[13px] font-medium text-accent hover:bg-accent-soft"
      >
        <Plus className="size-4" /> Nouveau modèle
      </button>
    );
  }

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    startTransition(async () => {
      const result = await saveTemplate(template?.id ?? null, form);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(template ? "Modèle enregistré" : "Modèle créé");
      setOpen(false);
      if (!template) setForm(EMPTY);
    });
  };

  const remove = () =>
    startTransition(async () => {
      if (!template) return;
      await deleteTemplate(template.id);
      toast.success(`Modèle « ${template.name} » supprimé`);
    });

  return (
    <form onSubmit={save} className="space-y-3 rounded-xl border border-line bg-surface p-4 shadow-card">
      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <div>
          <label htmlFor={`tpl-name-${id}`} className={labelClass}>Nom</label>
          <input id={`tpl-name-${id}`} required value={form.name} onChange={(e) => set({ name: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`tpl-type-${id}`} className={labelClass}>Type de projet</label>
          <select id={`tpl-type-${id}`} value={form.type} onChange={(e) => set({ type: e.target.value as ProjectType })} className={fieldClass}>
            {PROJECT_TYPES.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={`tpl-milestones-${id}`} className={labelClass}>Jalons (un par ligne)</label>
          <textarea id={`tpl-milestones-${id}`} rows={4} value={form.milestones} onChange={(e) => set({ milestones: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`tpl-zones-${id}`} className={labelClass}>Pages (une par ligne)</label>
          <textarea id={`tpl-zones-${id}`} rows={4} value={form.zones} onChange={(e) => set({ zones: e.target.value })} className={fieldClass} />
        </div>
      </div>
      <div>
        <label htmlFor={`tpl-tasks-${id}`} className={labelClass}>
          Tâches de départ ({taskCount}) : Titre | Page | Jalon | J+3 | 2h
        </label>
        <textarea
          id={`tpl-tasks-${id}`}
          rows={8}
          value={form.tasks}
          onChange={(e) => set({ tasks: e.target.value })}
          className={cn(fieldClass, "font-mono text-[12px]")}
        />
      </div>
      <div className="flex flex-wrap justify-end gap-2">
        {template && (
          <GhostButton
            type="button"
            disabled={pending}
            onClick={() => (confirmDelete ? remove() : setConfirmDelete(true))}
            className={cn("mr-auto", confirmDelete && "border-danger text-danger")}
          >
            {confirmDelete ? "Confirmer la suppression" : "Supprimer"}
          </GhostButton>
        )}
        <GhostButton type="button" onClick={() => setOpen(false)}>Fermer</GhostButton>
        <PrimaryButton type="submit" disabled={pending}>Enregistrer</PrimaryButton>
      </div>
    </form>
  );
}
