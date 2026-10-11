"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

export type SegmentOption<T extends string> = { value: T; label: React.ReactNode; icon?: React.ReactNode };

/**
 * Choix exclusif en segments (radiogroup) : flèches pour changer, Tab entre et sort du
 * groupe. Remplace les groupes de boutons « aria-pressed » faits à la main.
 */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
  size = "md",
  className,
}: {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  /** Nom accessible du groupe. */
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const group = useRef<HTMLDivElement>(null);

  const move = (event: React.KeyboardEvent, index: number) => {
    const delta = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    event.preventDefault();
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    group.current?.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus();
  };

  return (
    <div
      ref={group}
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex gap-0.5 rounded-lg bg-sunken p-1", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => move(event, index)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-md font-medium outline-hidden transition-[background-color,color,box-shadow] focus-visible:shadow-[var(--ring)] pointer-coarse:min-h-11",
              size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-ui",
              selected ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
