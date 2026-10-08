/** Calcul de position pour les menus flottants (position: fixed, coordonnées du viewport). */
export type Box = { top: number; left: number; width: number; height: number };
export type Placement = "top" | "bottom";
export type Align = "start" | "center" | "end";

export type FloatingOptions = {
  placement?: Placement;
  align?: Align;
  /** Écart entre l’ancre et l’élément flottant. */
  offset?: number;
  /** Marge minimale avec les bords du viewport. */
  margin?: number;
};

/**
 * Place `size` près de `anchor` : du côté demandé, retourné de l’autre côté s’il n’y a pas
 * la place (et qu’il y en a de l’autre), puis ramené dans le viewport horizontalement.
 */
export function computeFloatingPosition(
  anchor: Box,
  size: { width: number; height: number },
  viewport: { width: number; height: number },
  { placement = "bottom", align = "start", offset = 4, margin = 8 }: FloatingOptions = {},
): { top: number; left: number; placement: Placement } {
  const spaceBelow = viewport.height - (anchor.top + anchor.height) - margin;
  const spaceAbove = anchor.top - margin;
  const need = size.height + offset;

  let side = placement;
  if (side === "bottom" && spaceBelow < need && spaceAbove > spaceBelow) side = "top";
  else if (side === "top" && spaceAbove < need && spaceBelow > spaceAbove) side = "bottom";

  const top = side === "bottom" ? anchor.top + anchor.height + offset : anchor.top - size.height - offset;

  let left =
    align === "start"
      ? anchor.left
      : align === "end"
        ? anchor.left + anchor.width - size.width
        : anchor.left + anchor.width / 2 - size.width / 2;
  left = Math.max(margin, Math.min(left, viewport.width - size.width - margin));

  return { top: Math.max(margin, top), left, placement: side };
}
