"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { createProject } from "@/app/actions/projects";
import { useApp } from "@/components/app-context";
import { Dialog, fieldClass, labelClass } from "@/components/dialog";
import { ProjectTemplateFields } from "@/components/project-template-fields";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { PROJECT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export { DeliveryDialog } from "@/components/delivery-dialog";
export { ImportDialog } from "@/components/import-dialog";
export { RecapDialog } from "@/components/recap-dialog";

export function NewProjectDialog() {
  const { newProjectOpen, setNewProjectOpen, clients } = useApp();
  const [state, action, pending] = useActionState(createProject, undefined);
  const pathname = usePathname();

  // Une création réussie redirige vers le projet : on ferme à ce moment-là.
  useEffect(() => setNewProjectOpen(false), [pathname, setNewProjectOpen]);
  const [color, setColor] = useState(PROJECT_COLORS[5]);
  const [due, setDue] = useState<string | null>(null);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");

  return (
    <Dialog
      open={newProjectOpen}
      onClose={() => setNewProjectOpen(false)}
      title="Nouveau projet"
      footer={
        <>
          <Button onClick={() => setNewProjectOpen(false)}>Annuler</Button>
          <Button variant="primary" type="submit" form="new-project-form" loading={pending}>
            {pending ? "Création…" : "Créer le projet"}
          </Button>
        </>
      }
    >
      <form id="new-project-form" action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
          <div>
            <label htmlFor="project-name" className={labelClass}>Nom</label>
            <input id="project-name" name="name" required autoFocus placeholder="Bières Georges" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="project-key" className={labelClass}>Préfixe</label>
            <input
              id="project-key"
              name="key"
              maxLength={4}
              pattern="[A-Za-z0-9]{1,4}"
              title="1 à 4 lettres ou chiffres"
              placeholder="BG"
              className={cn(fieldClass, "font-mono uppercase")}
            />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Client ou agence</legend>
          <SegmentedControl
            className="mb-2"
            label="Type de saisie du client"
            value={clientMode}
            onChange={setClientMode}
            options={clients.length ? [{ value: "existing", label: "Existant" }, { value: "new", label: "Nouveau" }] : [{ value: "new", label: "Nouveau" }]}
          />
          {clientMode === "existing" ? (
            <select name="clientId" aria-label="Client" className={fieldClass} defaultValue="">
              <option value="">Aucun (projet interne)</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          ) : (
            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input name="newClient" aria-label="Nom du client" placeholder="Agence 33 Degrés" className={fieldClass} />
              <select name="clientKind" aria-label="Type de client" className={cn(fieldClass, "w-auto")} defaultValue="AGENCY">
                <option value="AGENCY">Agence partenaire</option>
                <option value="DIRECT">Client direct</option>
              </select>
            </div>
          )}
        </fieldset>

        {newProjectOpen && <ProjectTemplateFields />}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="project-end" className={labelClass}>Client final</label>
            <input id="project-end" name="endClient" placeholder="Bières Georges (Julien)" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="project-due" className={labelClass}>Échéance</label>
            <DatePicker id="project-due" name="dueDate" label="Échéance" value={due} onChange={setDue} />
          </div>
        </div>
        <div>
          <label htmlFor="project-url" className={labelClass}>Lien du site ou de la maquette</label>
          <input id="project-url" name="siteUrl" type="url" placeholder="https://bieres.netlify.app" className={fieldClass} />
        </div>

        <div>
          <span className={labelClass}>Couleur</span>
          <input type="hidden" name="color" value={color} />
          <div className="flex gap-1.5">
            {PROJECT_COLORS.map((swatch) => (
              <button
                key={swatch}
                type="button"
                aria-label={`Couleur ${swatch}`}
                aria-pressed={color === swatch}
                onClick={() => setColor(swatch)}
                style={{ backgroundColor: swatch }}
                className={cn("size-6 rounded-sm transition-transform", color === swatch && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              />
            ))}
          </div>
        </div>

        {state?.error && <p className="text-ui text-danger-text">{state.error}</p>}
      </form>
    </Dialog>
  );
}
