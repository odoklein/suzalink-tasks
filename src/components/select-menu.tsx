"use client";

import { Check } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export type MenuOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
};

/**
 * Menu de sélection compact (statut, priorité, assignation…).
 * Clavier : flèches pour naviguer, Entrée pour choisir, Échap pour fermer,
 * et filtre au clavier quand `searchable` est actif.
 */
export function SelectMenu<T extends string>({
  value,
  options,
  onChange,
  trigger,
  searchable = false,
  align = "start",
  label,
}: {
  value: T | null;
  options: MenuOption<T>[];
  onChange: (value: T) => void;
  trigger: React.ReactNode;
  searchable?: boolean;
  align?: "start" | "end";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();

  const filtered = query
    ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const choose = (option: MenuOption<T> | undefined) => {
    if (!option) return;
    onChange(option.value);
    setOpen(false);
    setQuery("");
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      choose(filtered[active]);
    } else if (event.key === "Escape") {
      event.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={open ? onKeyDown : undefined}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
          setActive(Math.max(0, options.findIndex((option) => option.value === value)));
        }}
        className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1 text-left text-[13px] text-ink-2 transition-colors hover:bg-sunken"
      >
        {trigger}
      </button>

      {open && (
        <div
          className={cn(
            "animate-pop-in absolute top-full z-50 mt-1 w-56 overflow-hidden rounded-lg border border-line bg-surface p-1 shadow-pop",
            align === "end" ? "right-0" : "left-0",
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {searchable && (
            <input
              autoFocus
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setActive(0);
              }}
              placeholder="Filtrer…"
              aria-label={`Filtrer : ${label}`}
              className="mb-1 w-full rounded-md bg-surface-2 px-2 py-1.5 text-[13px] outline-none placeholder:text-faint"
            />
          )}
          <ul id={listId} role="listbox" aria-label={label} className="max-h-64 overflow-y-auto scroll-thin">
            {filtered.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px]",
                  index === active && "bg-sunken",
                )}
              >
                {option.icon}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint && <span className="text-[11px] text-faint">{option.hint}</span>}
                {option.value === value && <Check className="size-3.5 text-accent" />}
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-2 text-[13px] text-muted">Aucun résultat</li>}
          </ul>
          {!searchable && (
            // Focus sur la liste pour que les flèches fonctionnent sans champ de recherche
            <input autoFocus aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" readOnly />
          )}
        </div>
      )}
    </div>
  );
}
