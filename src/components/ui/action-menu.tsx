"use client";

import { useEffect, useState } from "react";

import { Floating } from "@/components/ui/floating";
import { cn } from "@/lib/utils";

export type ActionItem = {
  label: string;
  icon?: React.ReactNode;
  hint?: React.ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

/**
 * Menu d’actions (role=menu) ouvert par un bouton : flèches haut/bas, Début/Fin, Entrée,
 * Échap (rend le focus au bouton). Rendu en portail, donc jamais coupé par un overflow.
 * `trigger` reçoit les props à poser sur le bouton déclencheur.
 */
export function ActionMenu({
  items,
  label,
  trigger,
  align = "end",
  className,
}: {
  items: ActionItem[];
  label: string;
  trigger: (props: {
    ref: (element: HTMLButtonElement | null) => void;
    onClick: () => void;
    "aria-haspopup": "menu";
    "aria-expanded": boolean;
  }) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<HTMLDivElement | null>(null);

  const focusItem = (index: number) => {
    const elements = list?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])');
    if (!elements?.length) return;
    elements[(index + elements.length) % elements.length].focus();
  };

  // À l’ouverture, le focus va sur la première action.
  useEffect(() => {
    if (open && list) list.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
  }, [open, list]);

  const close = () => {
    setOpen(false);
    anchor?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    const elements = [...(list?.querySelectorAll<HTMLElement>('[role="menuitem"]:not([disabled])') ?? [])];
    const current = elements.indexOf(document.activeElement as HTMLElement);
    if (event.key === "ArrowDown") focusItem(current + 1);
    else if (event.key === "ArrowUp") focusItem(current - 1);
    else if (event.key === "Home") focusItem(0);
    else if (event.key === "End") focusItem(elements.length - 1);
    else if (event.key === "Tab") setOpen(false);
    else return;
    event.preventDefault();
  };

  return (
    <>
      {trigger({
        ref: setAnchor,
        onClick: () => {
          setOpen((value) => !value);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
      })}
      <Floating anchor={anchor} open={open} onDismiss={close} align={align} className="animate-pop-in">
        <div
          ref={setList}
          role="menu"
          aria-label={label}
          onKeyDown={onKeyDown}
          className={cn("min-w-48 rounded-md border border-line bg-surface p-1 shadow-pop", className)}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              tabIndex={-1}
              disabled={item.disabled}
              onClick={() => {
                setOpen(false);
                anchor?.focus();
                item.onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-ui outline-hidden hover:bg-sunken focus-visible:bg-sunken disabled:opacity-45",
                item.tone === "danger" ? "text-danger-text" : "text-ink",
              )}
            >
              {item.icon && <span className="flex size-4 shrink-0 items-center justify-center text-muted [&>svg]:size-4">{item.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              {item.hint && <span className="text-meta text-muted">{item.hint}</span>}
            </button>
          ))}
        </div>
      </Floating>
    </>
  );
}
