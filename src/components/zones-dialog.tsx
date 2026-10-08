"use client";

import { Merge } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { mergeZones } from "@/app/actions/zones";
import { Dialog, fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { plural } from "@/lib/plural";

/** « Fusionner les pages » : réunit les orthographes d’une même page (Homepage / Accueil / Home). */
export function ZonesButton({ projectId, zones }: { projectId: string; zones: { name: string; count: number }[] }) {
  const [open, setOpen] = useState(false);
  if (zones.length < 2) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-sunken hover:text-ink"
      >
        <Merge className="size-3.5" aria-hidden /> Fusionner les pages
      </button>
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
        <ul className="max-h-64 space-y-1 overflow-y-auto scroll-thin">
          {zones.map((zone) => (
            <li key={zone.name}>
              <label className="flex items-center gap-2 rounded-md px-2 py-1 text-[13px] hover:bg-surface-2">
                <input type="checkbox" checked={selected.has(zone.name)} onChange={() => toggle(zone.name)} className="accent-[var(--accent)]" />
                <span className="min-w-0 flex-1 truncate">{zone.name}</span>
                <span className="tabular text-[12px] text-muted">{plural(zone.count, "tâche")}</span>
              </label>
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
