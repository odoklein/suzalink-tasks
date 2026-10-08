"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

export type MenuOption<T extends string> = {
  value: T;
  label: string;
  icon?: React.ReactNode;
  hint?: string;
};

const MARGIN = 8; // distance minimale au bord de la fenêtre
const GAP = 4; // distance entre le déclencheur et le menu
const LIST_MAX = 256; // hauteur maximale de la liste (px)

type Placement = { left: number; top?: number; bottom?: number; listMax: number };

/**
 * Menu de sélection compact (statut, priorité, assignation…).
 * Clavier : flèches pour naviguer, Entrée pour choisir, Échap pour fermer,
 * et filtre au clavier quand `searchable` est actif.
 *
 * La liste est rendue dans un portail (`document.body`) en `position: fixed`, placée d'après le
 * déclencheur : aucun conteneur `overflow-hidden` (ligne, liste, tiroir, dialogue) ne peut la couper.
 * Elle s'ouvre vers le haut quand il manque de la place en bas, et suit le défilement et le
 * redimensionnement.
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
  const [placement, setPlacement] = useState<Placement | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const filtered = query
    ? options.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  /** Calcule la position fixe du menu à partir du déclencheur (ouvre vers le haut si besoin). */
  const place = useCallback(() => {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    const list = listRef.current;
    if (!trigger || !menu || !list) return;
    const rect = trigger.getBoundingClientRect();
    // Hauteur « naturelle » : indépendante de la hauteur déjà imposée à la liste, pour ne pas osciller.
    const chrome = menu.offsetHeight - list.offsetHeight;
    const natural = chrome + Math.min(list.scrollHeight, LIST_MAX);
    const below = window.innerHeight - rect.bottom - MARGIN - GAP;
    const above = rect.top - MARGIN - GAP;
    const placeAbove = natural > below && above > below;
    const width = menu.offsetWidth;
    const wanted = align === "end" ? rect.right - width : rect.left;
    const left = Math.max(MARGIN, Math.min(wanted, window.innerWidth - width - MARGIN));
    const next: Placement = {
      left,
      ...(placeAbove ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      listMax: Math.max(96, Math.min(LIST_MAX, (placeAbove ? above : below) - chrome)),
    };
    setPlacement((previous) =>
      previous &&
      previous.left === next.left &&
      previous.top === next.top &&
      previous.bottom === next.bottom &&
      previous.listMax === next.listMax
        ? previous
        : next,
    );
  }, [align]);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    // `capture` : on suit aussi le défilement des conteneurs internes (liste, tiroir).
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, place, filtered.length]);

  const close = useCallback(() => {
    setOpen(false);
    setPlacement(null);
  }, []);

  /**
   * Le nœud appartient-il au déclencheur ou au menu ? On repère le menu par son attribut plutôt que par
   * `menuRef` : à l'ouverture, `autoFocus` déclenche un `blur` avant que la ref du menu ne soit posée.
   */
  const inside = useCallback(
    (node: EventTarget | null) =>
      node instanceof Element && (Boolean(root.current?.contains(node)) || node.closest(`[data-select-menu="${listId}"]`) !== null),
    [listId],
  );

  // Clic ou toucher hors du menu et de son déclencheur.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!inside(event.target)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close, inside]);

  const choose = (option: MenuOption<T> | undefined) => {
    if (!option) return;
    onChange(option.value);
    close();
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
      close();
    }
  };

  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={open ? onKeyDown : undefined}
      // Le focus quitte le menu et son déclencheur (Tab…) : on referme. (`relatedTarget` nul = fenêtre
      // qui perd le focus ou clic sur une zone non focalisable : le `pointerdown` ci-dessus s'en charge.)
      onBlur={
        open
          ? (event) => {
              if (event.relatedTarget && !inside(event.relatedTarget)) close();
            }
          : undefined
      }
    >
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={(event) => {
          event.stopPropagation();
          if (open) close();
          else setOpen(true);
          setActive(Math.max(0, options.findIndex((option) => option.value === value)));
        }}
        className="flex min-w-0 items-center gap-2 rounded-sm px-1.5 py-1 text-left text-ui text-ink-2 transition-colors hover:bg-sunken"
      >
        {trigger}
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            data-select-menu={listId}
            style={{
              left: placement?.left ?? 0,
              top: placement?.top,
              bottom: placement?.bottom,
              visibility: placement ? "visible" : "hidden",
            }}
            className="animate-pop-in fixed z-popover w-56 overflow-hidden rounded-md border border-line bg-surface p-1 shadow-pop"
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
              className="mb-1 w-full rounded-sm bg-surface-2 px-2 py-1.5 text-ui outline-none placeholder:text-faint"
            />
          )}
          <ul
            ref={listRef}
            id={listId}
            role="listbox"
            aria-label={label}
            style={{ maxHeight: placement?.listMax ?? LIST_MAX }}
            className="overflow-y-auto scroll-thin"
          >
            {filtered.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                onMouseEnter={() => setActive(index)}
                onClick={() => choose(option)}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-ui",
                  index === active && "bg-sunken",
                )}
              >
                {option.icon}
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {option.hint && <span className="text-meta text-muted">{option.hint}</span>}
                {option.value === value && <Check className="size-3.5 text-accent" />}
              </li>
            ))}
            {filtered.length === 0 && <li className="px-2 py-2 text-ui text-muted">Aucun résultat</li>}
          </ul>
          {!searchable && (
            // Focus sur la liste pour que les flèches fonctionnent sans champ de recherche
            <input autoFocus aria-hidden className="pointer-events-none absolute h-0 w-0 opacity-0" readOnly />
          )}
          </div>,
          document.body,
        )}
    </div>
  );
}
