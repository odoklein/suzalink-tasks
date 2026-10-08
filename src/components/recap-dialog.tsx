"use client";

import { ClipboardCopy, Code, Mail } from "lucide-react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { getRecapFacts, logRecapSent } from "@/app/actions/deliveries";
import { Dialog, fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { mailtoLink } from "@/lib/chasing";
import { buildRecapText, recapTextToHtml, type RecapFacts, type RecapOptions } from "@/lib/recap";
import { fromParisDateTimeInput, toParisDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";

type Loaded = {
  facts: RecapFacts;
  to: { id: string; name: string; email: string | null } | null;
};

/**
 * Récap client v2 : généré dès l'ouverture, modèle selon le type de client,
 * sections facultatives. Monté seulement quand la fenêtre est ouverte : l'état
 * repart de zéro à chaque ouverture.
 */
export function RecapDialog({ onClose, projectId }: { onClose: () => void; projectId: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [since, setSince] = useState("");
  const [options, setOptions] = useState<Omit<RecapOptions, "since">>({
    whiteLabel: false,
    includeBillable: true,
    includeWaiting: true,
  });
  const [stale, setStale] = useState(false);
  const [pending, startTransition] = useTransition();

  const sinceDate = since ? fromParisDateTimeInput(`${since}T00:00`) : null;
  const generated = useMemo(
    () => (loaded ? buildRecapText(loaded.facts, { ...options, since: sinceDate }) : null),
    // sinceDate dérive de `since`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [loaded, options, since],
  );

  useEffect(() => {
    let cancelled = false;
    getRecapFacts(projectId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const initialSince = result.defaultSince ? toParisDateInput(result.defaultSince) : "";
      setSince(initialSince);
      setLoaded({ facts: result.facts, to: result.to });
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Texte retouché à la main (null : on affiche le texte généré, qui suit les options).
  const [customText, setCustomText] = useState<string | null>(null);
  const edited = customText !== null;
  const text = customText ?? generated?.text ?? "";

  // Une option change : le texte généré suit ; s'il a été retouché, on prévient avant de le remplacer.
  const change = (apply: () => void) => {
    apply();
    if (edited) setStale(true);
  };
  const regenerate = () => {
    setCustomText(null);
    setStale(false);
  };

  const record = (via: "EMAIL" | "WEB") =>
    startTransition(async () => {
      const result = await logRecapSent(projectId, {
        body: text,
        since: sinceDate?.toISOString() ?? null,
        toId: loaded?.to?.id ?? null,
        via,
      });
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Récap enregistré dans l’historique");
      onClose();
    });

  const copy = async (html: boolean) => {
    try {
      if (html && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([recapTextToHtml(text)], { type: "text/html" }),
            "text/plain": new Blob([text], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      toast.error("Copie impossible : sélectionnez le texte et copiez-le à la main.");
      return;
    }
    record("WEB");
  };

  const openMail = async () => {
    if (!generated) return;
    const link = mailtoLink(loaded?.to?.email, generated.subject, text);
    if (!link) {
      toast.error("Récap trop long pour la messagerie : il a été copié, collez-le dans un nouvel e-mail.");
      await copy(false);
      return;
    }
    window.location.href = link;
    record("EMAIL");
  };

  const agency = loaded?.facts.clientKind === "AGENCY";
  const counts = generated?.counts;

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title="Récap client"
      description={
        agency
          ? "Version agence : technique, avec les références des tâches. Relisez-le avant envoi."
          : "Version client direct : langage simple, sans statut interne. Relisez-le avant envoi."
      }
    >
      {error ? (
        <p role="alert" className="text-[13px] text-danger">{error}</p>
      ) : !loaded ? (
        <p className="text-[13px] text-muted" aria-busy="true">Préparation du récap…</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
            <div>
              <label htmlFor="recap-since" className={labelClass}>Tâches faites depuis</label>
              <input
                id="recap-since"
                type="date"
                value={since}
                onChange={(event) => change(() => setSince(event.target.value))}
                className={cn(fieldClass, "w-auto")}
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={options.includeBillable}
                onChange={(event) => change(() => setOptions((o) => ({ ...o, includeBillable: event.target.checked })))}
                className="accent-[var(--accent)]"
              />
              Modifications supplémentaires
            </label>
            <label className="flex items-center gap-2 text-[13px] text-ink-2">
              <input
                type="checkbox"
                checked={options.includeWaiting}
                onChange={(event) => change(() => setOptions((o) => ({ ...o, includeWaiting: event.target.checked })))}
                className="accent-[var(--accent)]"
              />
              En attente de votre côté
            </label>
            {agency && (
              <label className="flex items-center gap-2 text-[13px] text-ink-2">
                <input
                  type="checkbox"
                  checked={options.whiteLabel}
                  onChange={(event) => change(() => setOptions((o) => ({ ...o, whiteLabel: event.target.checked })))}
                  className="accent-[var(--accent)]"
                />
                Marque blanche
              </label>
            )}
          </div>

          {counts && (
            <p className="text-[12px] text-muted">
              {counts.done} faites{counts.billable ? ` · ${counts.billable} supplémentaires` : ""} · {counts.waiting} en attente client · {counts.remaining} en cours
              {loaded.to && <> · À{" "}: {loaded.to.name}</>}
            </p>
          )}
          {stale && (
            <p role="status" className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-[12px] text-ink-2">
              Régénérer va remplacer vos modifications.
              <button type="button" onClick={regenerate} className="font-medium text-accent hover:underline">Régénérer</button>
              <button type="button" onClick={() => setStale(false)} className="text-muted hover:underline">Garder mon texte</button>
            </p>
          )}
          <textarea
            value={text}
            onChange={(event) => {
              setCustomText(event.target.value);
            }}
            rows={14}
            aria-label="Texte du récap"
            className={cn(fieldClass, "text-[13px] leading-relaxed")}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <GhostButton type="button" disabled={pending} onClick={() => copy(false)}>
              <ClipboardCopy className="size-4" /> Copier
            </GhostButton>
            <GhostButton type="button" disabled={pending} onClick={() => copy(true)}>
              <Code className="size-4" /> Copier en HTML
            </GhostButton>
            <PrimaryButton type="button" disabled={pending} onClick={openMail}>
              <Mail className="size-4" /> Ouvrir dans la messagerie
            </PrimaryButton>
          </div>
        </div>
      )}
    </Dialog>
  );
}
