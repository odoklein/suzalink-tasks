"use client";

import { cloneElement, useEffect, useId, useRef, useState } from "react";

import { Floating } from "@/components/ui/floating";
import { Kbd } from "@/components/ui/kbd";
import type { Placement } from "@/lib/floating";

/**
 * Infobulle : apparaît après 120 ms au survol ou au focus clavier, jamais au toucher, et se
 * ferme avec Échap (WCAG 1.4.13). Remplace l’attribut `title`. Le contenu décrit l’élément
 * (aria-describedby) ; pour un bouton-icône, le nom accessible reste `aria-label`.
 */
export function Tooltip({
  content,
  shortcut,
  placement = "top",
  delay = 120,
  children,
}: {
  content: React.ReactNode;
  /** Raccourci affiché à droite, par exemple « Mod+K ». */
  shortcut?: string;
  placement?: Placement;
  delay?: number;
  children: React.ReactElement;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const id = useId();

  useEffect(() => () => clearTimeout(timer.current), []);

  const show = (target: HTMLElement) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setAnchor(target.firstElementChild as HTMLElement | null);
      setOpen(true);
    }, delay);
  };
  const hide = () => {
    clearTimeout(timer.current);
    setOpen(false);
  };

  if (!content) return children;

  return (
    <span
      className="contents"
      onPointerEnter={(event) => event.pointerType !== "touch" && show(event.currentTarget)}
      onPointerLeave={hide}
      onPointerDown={hide}
      onFocus={(event) => {
        if ((event.target as HTMLElement).matches(":focus-visible")) show(event.currentTarget);
      }}
      onBlur={hide}
      onKeyDown={(event) => event.key === "Escape" && hide()}
    >
      {cloneElement(children, { "aria-describedby": open ? id : undefined } as React.HTMLAttributes<HTMLElement>)}
      <Floating
        anchor={anchor}
        open={open}
        placement={placement}
        align="center"
        offset={6}
        onDismiss={hide}
        id={id}
        role="tooltip"
        className="pointer-events-none"
      >
        <span className="flex max-w-xs items-center gap-2 rounded-sm bg-ink px-2 py-1 text-meta font-medium text-bg shadow-pop">
          {content}
          {shortcut && <Kbd keys={shortcut} onInk />}
        </span>
      </Floating>
    </span>
  );
}
