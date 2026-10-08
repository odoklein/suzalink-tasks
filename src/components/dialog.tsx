"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { Button, IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Fenêtre modale simple : Échap ou clic à l'extérieur pour fermer. `footer` : zone d'actions
 * fixe en bas (Annuler / Valider), alignée à droite ; pour un formulaire, relier le bouton de
 * validation avec l'attribut `form`.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="animate-fade-in fixed inset-0 z-dialog flex items-start justify-center bg-[var(--scrim)] px-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          "animate-pop-in flex max-h-[80vh] w-full flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-overlay",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-title font-semibold tracking-[-0.01em]">{title}</h2>
            {description && <p className="mt-0.5 text-ui text-muted">{description}</p>}
          </div>
          <IconButton label="Fermer" onClick={onClose}>
            <X className="size-4" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 scroll-thin">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-surface-2 px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export const fieldClass =
  "w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-body outline-hidden transition-colors placeholder:text-faint focus-visible:border-accent focus-visible:bg-surface focus-visible:shadow-[var(--ring)] pointer-coarse:text-[16px]";

export const labelClass = "mb-1.5 block text-xs font-medium text-ink-2";

/** Alias historiques de Button (variantes primary et secondary). */
export function PrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="primary" {...props} />;
}

export function GhostButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="secondary" {...props} />;
}
