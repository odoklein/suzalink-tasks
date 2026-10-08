"use client";

import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "size"> & {
  /** Texte cliquable à droite. */
  label?: React.ReactNode;
};

/** Case à cocher : un vrai <input type="checkbox"> (clavier, formulaires) habillé. */
export function Checkbox({ label, className, ...props }: Props) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-ui text-ink-2", props.disabled && "cursor-not-allowed opacity-45", className)}>
      <input type="checkbox" {...props} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "grid size-4 shrink-0 place-items-center rounded-xs border border-line-strong bg-surface text-accent-ink transition-colors",
          "peer-checked:border-accent peer-checked:bg-accent peer-focus-visible:shadow-[var(--ring)]",
          "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
        )}
      >
        <Check className="size-3" strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}

/** Interrupteur : même <input> natif, avec role="switch". */
export function Switch({ label, className, ...props }: Props) {
  return (
    <label className={cn("inline-flex cursor-pointer items-center gap-2 text-ui text-ink-2", props.disabled && "cursor-not-allowed opacity-45", className)}>
      <input type="checkbox" role="switch" {...props} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 shrink-0 rounded-full bg-line-strong transition-colors",
          "after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-surface after:shadow-xs after:transition-transform",
          "peer-checked:bg-accent peer-checked:after:translate-x-4 peer-focus-visible:shadow-[var(--ring)]",
        )}
      />
      {label}
    </label>
  );
}
