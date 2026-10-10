"use client";

import { Merge } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { mergeZones } from "@/app/actions/zones";
import { Dialog, fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { plural } from "@/lib/plural";

/** « Fusionner les pages » : réunit les orthographes d’une même page (Homepage / Accueil / Home). */
export function ZonesButton({ projectId, zones }: { projectId: string; zones: { name: string; count: number }[] }) {
  const [open, setOpen] = useState(false);
  if (zones.length < 2) return null;
  return (
    <>
      <Button variant="ghost" size="sm" icon={<Merge className="size-3.5" aria-hidden />} onClick={() => setOpen(true)} className="text-muted">
        Fusionner les pages
      </Button>
      {open && <ZonesDialog projectId={projectId} zones={zones} onClose={() => setOpen(false)} />}
    </>
  );
}

function ZonesDialog({
  projectId,
  zones,
  onClose,
}: {
  projectId: string;
  zones: { name: string; count: number }[];
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Nom proposé : la page sélectionnée la plus utilisée.
  const proposed = zones.filter((zone) => selected.has(zone.name)).sort((a, b) => b.count - a.count)[0]?.name ?? "";
  const into = target ?? proposed;

  const toggle = (name: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  const submit = () =>
    startTransition(async () => {
      const result = await mergeZones(projectId, [...selected], into);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${plural(result.moved ?? 0, "tâche déplacée", "tâches déplacées")} vers « ${into} »`);
      onClose();
    });

  return (
    <Dialog open onClose={onClose} title="Fusionner les pages" description="Cochez les pages qui désignent la même chose, puis choisissez le nom à garder.">
      <div className="space-y-3">
        <ul className="max-h-64 space-y-1 overflow-y-auto overscroll-contain scroll-thin">
          {zones.map((zone) => (
            <li key={zone.name}>
              <Checkbox
                checked={selected.has(zone.name)}
                onChange={() => toggle(zone.name)}
                className="flex w-full rounded-md px-2 py-1 hover:bg-surface-2"
                label={
                  <>
                    <span className="min-w-0 flex-1 truncate">{zone.name}</span>
                    <span className="tabular text-xs text-muted">{plural(zone.count, "tâche")}</span>
                  </>
                }
              />
            </li>
          ))}
        </ul>
        <div>
          <label htmlFor="merge-into" className={labelClass}>Nom de la page fusionnée</label>
          <input id="merge-into" value={into} onChange={(event) => setTarget(event.target.value)} className={fieldClass} />
        </div>
        <div className="flex justify-end gap-2">
          <GhostButton type="button" onClick={onClose}>Annuler</GhostButton>
          <PrimaryButton type="button" disabled={pending || selected.size === 0 || !into.trim() || (selected.size === 1 && selected.has(into.trim()))} onClick={submit}>
            Fusionner
          </PrimaryButton>
        </div>
      </div>
    </Dialog>
  );
}
