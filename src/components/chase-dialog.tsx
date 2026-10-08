"use client";

import { ClipboardCopy, Mail, Send } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { getChaseDraft, logFollowUp } from "@/app/actions/chasing";
import { Dialog, fieldClass, GhostButton, PrimaryButton } from "@/components/dialog";
import { mailtoLink } from "@/lib/chasing";
import { cn } from "@/lib/utils";

type Draft = {
  subject: string;
  body: string;
  to: { id: string; name: string; email: string | null } | null;
  taskIds: string[];
};

/** Bouton « Relancer » : ouvre la relance prête à envoyer pour le projet. */
export function ChaseButton({
  projectId,
  projectName,
  compact = false,
  className,
}: {
  projectId: string;
  projectName: string;
  compact?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={compact ? `Relancer le client · ${projectName}` : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
          compact
            ? "px-1.5 py-0.5 text-[11px] text-st-waiting hover:bg-[color-mix(in_srgb,var(--st-waiting)_14%,transparent)]"
            : "border border-line bg-surface px-3 py-2 text-[13px] text-ink-2 hover:border-line-strong hover:text-ink",
          className,
        )}
      >
        <Send className={compact ? "size-3" : "size-4"} aria-hidden />
        Relancer
      </button>
      {open && <ChaseDialog projectId={projectId} projectName={projectName} onClose={() => setOpen(false)} />}
    </>
  );
}

function ChaseDialog({ projectId, projectName, onClose }: { projectId: string; projectName: string; onClose: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    getChaseDraft(projectId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDraft(result);
      setBody(result.body);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const record = () =>
    new Promise<boolean>((resolve) =>
      startTransition(async () => {
        if (!draft) return resolve(false);
        const result = await logFollowUp(projectId, { body, toId: draft.to?.id ?? null, taskIds: draft.taskIds });
        if ("error" in result && result.error) {
          toast.error(result.error);
          return resolve(false);
        }
        toast.success("Relance enregistrée : prochaine dans 5 jours");
        onClose();
        resolve(true);
      }),
    );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
    } catch {
      toast.error("Copie impossible : sélectionnez le texte et copiez-le à la main.");
      return;
    }
    await record();
  };

  const openMail = async () => {
    if (!draft) return;
    const link = mailtoLink(draft.to?.email, draft.subject, body);
    if (!link) {
      toast.error("Message trop long pour la messagerie : il a été copié, collez-le dans un nouvel e-mail.");
      await copy();
      return;
    }
    window.location.href = link;
    await record();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      wide
      title={`Relancer le client · ${projectName}`}
      description="Un message poli qui liste ce que nous attendons. Copier ou ouvrir dans la messagerie enregistre la relance dans l’historique."
    >
      {error ? (
        <p role="alert" className="text-[13px] text-danger">{error}</p>
      ) : !draft ? (
        <p className="text-[13px] text-muted" aria-busy="true">Préparation du message…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-[12px] text-muted">
            {draft.to
              ? <>À{" "}: <span className="text-ink-2">{draft.to.name}</span>{draft.to.email ? ` <${draft.to.email}>` : " (pas d’adresse email)"}</>
              : "Aucun contact principal : ajoutez-en un sur la page Clients pour personnaliser la salutation."}
            {" · "}Objet{" "}: <span className="text-ink-2">{draft.subject}</span>
          </p>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={14}
            aria-label="Texte de la relance"
            className={cn(fieldClass, "text-[13px] leading-relaxed")}
          />
          <div className="flex flex-wrap justify-end gap-2">
            <GhostButton type="button" disabled={pending} onClick={copy}>
              <ClipboardCopy className="size-4" /> Copier
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
