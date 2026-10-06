"use client";

import { X } from "lucide-react";
import { useEffect } from "react";

import { cn } from "@/lib/utils";

/** Fenêtre modale simple : Échap ou clic à l'extérieur pour fermer. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
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
    <div className="animate-fade-in fixed inset-0 z-[60] flex items-start justify-center bg-[rgb(10_12_16/0.42)] px-4 pt-[10vh] backdrop-blur-[2px]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(event) => event.stopPropagation()}
        className={cn(
          "animate-pop-in max-h-[80vh] w-full overflow-y-auto rounded-xl border border-line bg-surface shadow-pop scroll-thin",
          wide ? "max-w-2xl" : "max-w-lg",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[17px] font-semibold tracking-tight">{title}</h2>
            {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink">
            <X className="size-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

export const fieldClass =
  "w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-[14px] outline-none transition-colors placeholder:text-faint focus:border-accent focus:bg-surface";

export const labelClass = "mb-1.5 block text-[12px] font-medium text-ink-2";

export function PrimaryButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg bg-ink px-3.5 py-2 text-[13px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-50",
        className,
      )}
    />
  );
}

export function GhostButton({ className, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium text-ink-2 transition-colors hover:border-line-strong hover:text-ink disabled:opacity-50",
        className,
      )}
    />
  );
}
