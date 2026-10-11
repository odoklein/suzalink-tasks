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
          "relative grid size-4 shrink-0 place-items-center rounded-xs border border-control bg-surface text-primary-ink transition-colors",
          // Au toucher, la case se prolonge jusqu’à 44 px ; en contraste forcé, l’ombre disparaît, un contour la remplace.
          "pointer-coarse:after:absolute pointer-coarse:after:-inset-3.5 forced-colors:peer-focus-visible:outline-2 forced-colors:peer-focus-visible:outline-offset-2",
          "peer-checked:border-primary peer-checked:bg-primary peer-focus-visible:shadow-[var(--ring)]",
          "[&>svg]:opacity-0 peer-checked:[&>svg]:opacity-100",
        )}
      >
        <Check className="size-3 [stroke-width:3]" />
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
          "relative h-5 w-9 shrink-0 rounded-full bg-control transition-colors",
          "pointer-coarse:before:absolute pointer-coarse:before:inset-x-0 pointer-coarse:before:-inset-y-3 forced-colors:peer-focus-visible:outline-2 forced-colors:peer-focus-visible:outline-offset-2",
          "after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-surface after:shadow-xs after:transition-transform",
          "peer-checked:bg-primary peer-checked:after:translate-x-4 peer-focus-visible:shadow-[var(--ring)]",
        )}
      />
      {label}
    </label>
  );
}
