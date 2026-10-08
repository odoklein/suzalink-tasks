"use client";

import type { ProjectType } from "@prisma/client";
import Link from "next/link";
import { useEffect, useState } from "react";

import { listTemplates } from "@/app/actions/templates";
import { fieldClass, labelClass } from "@/components/dialog";
import { PROJECT_TYPES } from "@/lib/templates";
import { toParisDateInput } from "@/lib/time";

type TemplateOption = Awaited<ReturnType<typeof listTemplates>>[number];

/**
 * Champs « Modèle · Type · Démarrage » du formulaire Nouveau projet (P4-09) :
 * le modèle crée jalons, pages et tâches de départ avec des échéances relatives.
 */
export function ProjectTemplateFields() {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [type, setType] = useState<ProjectType | "">("");
  const [start] = useState(() => toParisDateInput(new Date()));

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((list) => !cancelled && setTemplates(list))
      .catch(() => !cancelled && setTemplates([]));
    return () => {
      cancelled = true;
    };
  }, []);

  const chosen = templates?.find((template) => template.id === templateId);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <label htmlFor="project-template" className={labelClass}>Modèle</label>
        <select
          id="project-template"
          name="templateId"
          value={templateId}
          onChange={(event) => {
            setTemplateId(event.target.value);
            const template = templates?.find((t) => t.id === event.target.value);
            if (template) setType(template.type);
          }}
          className={fieldClass}
        >
          <option value="">{templates === null ? "Chargement…" : "Aucun (projet vide)"}</option>
          {templates?.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name} ({template._count.tasks} tâches)
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="project-type" className={labelClass}>Type</label>
        <select id="project-type" name="type" value={type} onChange={(event) => setType(event.target.value as ProjectType)} className={fieldClass}>
          <option value="">Non précisé</option>
          {PROJECT_TYPES.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="project-start" className={labelClass}>Démarrage</label>
        <input id="project-start" name="startDate" type="date" defaultValue={start} className={fieldClass} />
      </div>
      <p className="text-[12px] text-muted sm:col-span-3">
        {chosen
          ? "Les échéances des tâches du modèle partent de la date de démarrage."
          : <>Les modèles se gèrent dans <Link href="/settings/templates" className="text-accent hover:underline">Paramètres › Modèles</Link>.</>}
      </p>
    </div>
  );
}
