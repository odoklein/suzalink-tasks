"use client";

import { useId, useRef } from "react";

import { cn } from "@/lib/utils";

export type TabItem<T extends string> = {
  value: T;
  label: React.ReactNode;
  /** Nombre affiché dans une pastille (omis = rien). */
  count?: number;
  icon?: React.ReactNode;
};

/**
 * Onglets soulignés : role=tablist/tab, flèches gauche/droite (et Début/Fin) avec tabindex
 * itinérant. À associer à <TabPanel> avec le même `idBase` (retourné par useTabIds).
 */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  idBase,
  className,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  idBase: string;
  className?: string;
}) {
  const list = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    let next = index;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = tabs.length - 1;
    else return;
    event.preventDefault();
    onChange(tabs[next].value);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div ref={list} role="tablist" aria-label={label} className={cn("flex gap-5 overflow-x-auto scroll-thin", className)}>
      {tabs.map((tab, index) => {
        const selected = tab.value === value;
        return (
          <button
            key={tab.value}
            id={`${idBase}-tab-${tab.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`${idBase}-panel-${tab.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(tab.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "-mb-px inline-flex shrink-0 items-center gap-1.5 border-b-2 py-2.5 text-ui font-medium outline-hidden transition-colors focus-visible:shadow-[var(--ring)]",
              selected ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {tab.icon}
            {tab.label}
            {tab.count !== undefined && (
              <span className={cn("tabular rounded-full px-1.5 text-meta font-semibold", selected ? "bg-sunken text-ink-2" : "bg-sunken text-muted")}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Contenu d’un onglet ; seul le panneau actif est rendu. */
export function TabPanel({
  idBase,
  value,
  active,
  children,
  className,
}: {
  idBase: string;
  value: string;
  active: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  if (!active) return null;
  return (
    <div id={`${idBase}-panel-${value}`} role="tabpanel" aria-labelledby={`${idBase}-tab-${value}`} tabIndex={0} className={cn("outline-hidden focus-visible:shadow-[var(--ring)]", className)}>
      {children}
    </div>
  );
}

/** Identifiant de base stable pour relier onglets et panneaux. */
export function useTabIds() {
  return useId();
}
