"use client";

import { useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

import { computeFloatingPosition, type Align, type Placement } from "@/lib/floating";
import { cn } from "@/lib/utils";

const noop = () => () => {};
/** Vrai seulement côté navigateur : le portail n’existe pas pendant le rendu serveur. */
export function useIsClient() {
  return useSyncExternalStore(noop, () => true, () => false);
}

/**
 * Élément flottant rendu dans <body> (donc jamais coupé par un overflow-hidden), en
 * position: fixed, placé près de `anchor`, retourné s’il manque de la place, replacé au
 * défilement et au redimensionnement. Ferme sur clic extérieur et sur Échap si `onDismiss`.
 * La couche (z-popover) est au-dessus du tiroir, des dialogues et de la palette.
 */
export function Floating({
  anchor,
  open,
  onDismiss,
  children,
  placement = "bottom",
  align = "start",
  offset = 4,
  matchAnchorWidth = false,
  className,
  ...rest
}: {
  anchor: HTMLElement | null;
  open: boolean;
  onDismiss?: () => void;
  children: React.ReactNode;
  placement?: Placement;
  align?: Align;
  offset?: number;
  matchAnchorWidth?: boolean;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "children">) {
  const isClient = useIsClient();
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = useRef(onDismiss);
  useLayoutEffect(() => {
    dismiss.current = onDismiss;
  });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!open || !anchor || !element) return;

    const place = () => {
      const rect = anchor.getBoundingClientRect();
      if (matchAnchorWidth) element.style.width = `${rect.width}px`;
      const { top, left, placement: side } = computeFloatingPosition(
        { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
        { width: element.offsetWidth, height: element.offsetHeight },
        { width: window.innerWidth, height: window.innerHeight },
        { placement, align, offset },
      );
      element.style.top = `${top}px`;
      element.style.left = `${left}px`;
      element.dataset.side = side;
      element.style.visibility = "visible";
    };

    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    const observer = new ResizeObserver(place);
    observer.observe(element);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
      observer.disconnect();
    };
  }, [open, anchor, placement, align, offset, matchAnchorWidth]);

  useLayoutEffect(() => {
    if (!open || !dismiss.current) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target) || anchor?.contains(target)) return;
      dismiss.current?.();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      dismiss.current?.();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, anchor]);

  if (!isClient || !open) return null;

  return createPortal(
    <div
      {...rest}
      ref={ref}
      style={{ position: "fixed", top: 0, left: 0, visibility: "hidden", ...rest.style }}
      className={cn("z-popover", className)}
    >
      {children}
    </div>,
    document.body,
  );
}
