"use client";

import { usePathname } from "next/navigation";
import { useActionState, useEffect, useState } from "react";

import { createProject } from "@/app/actions/projects";
import { useApp } from "@/components/app-context";
import { Dialog, fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { PROJECT_COLORS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function NewProjectDialog() {
  const { newProjectOpen, setNewProjectOpen, clients } = useApp();
  const [state, action, pending] = useActionState(createProject, undefined);
  const pathname = usePathname();

  // Une création réussie redirige vers le projet : on ferme à ce moment-là.
  useEffect(() => setNewProjectOpen(false), [pathname, setNewProjectOpen]);
  const [color, setColor] = useState(PROJECT_COLORS[5]);
  const [clientMode, setClientMode] = useState<"existing" | "new">(clients.length ? "existing" : "new");

  return (
    <Dialog open={newProjectOpen} onClose={() => setNewProjectOpen(false)} title="Nouveau projet">
      <form action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
          <div>
            <label htmlFor="project-name" className={labelClass}>Nom</label>
            <input id="project-name" name="name" required autoFocus placeholder="Bières Georges" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="project-key" className={labelClass}>Préfixe</label>
            <input id="project-key" name="key" maxLength={4} placeholder="BG" className={cn(fieldClass, "font-mono uppercase")} />
          </div>
        </div>

        <fieldset>
          <legend className={labelClass}>Client ou agence</legend>
          <div className="mb-2 flex gap-1 text-[12px]">
            {(["existing", "new"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                disabled={mode === "existing" && clients.length === 0}
                onClick={() => setClientMode(mode)}
                className={cn("rounded-md px-2.5 py-1 font-medium disabled:opacity-40", clientMode === mode ? "bg-sunken text-ink" : "text-muted")}
              >
                {mode === "existing" ? "Existant" : "Nouveau"}
              </button>
            ))}
          </div>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="project-end" className={labelClass}>Client final</label>
            <input id="project-end" name="endClient" placeholder="Bières Georges (Julien)" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="project-due" className={labelClass}>Échéance</label>
            <input id="project-due" name="dueDate" type="date" className={fieldClass} />
          </div>
        </div>
        <div>
          <label htmlFor="project-url" className={labelClass}>Lien du site ou de la maquette</label>
          <input id="project-url" name="siteUrl" placeholder="https://bieres.netlify.app" className={fieldClass} />
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
                className={cn("size-6 rounded-md transition-transform", color === swatch && "scale-110 ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              />
            ))}
          </div>
        </div>

        {state?.error && <p className="text-[13px] text-danger">{state.error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <GhostButton type="button" onClick={() => setNewProjectOpen(false)}>Annuler</GhostButton>
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Création…" : "Créer le projet"}</PrimaryButton>
        </div>
      </form>
    </Dialog>
  );
}
