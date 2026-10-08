import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "todo" | "progress" | "waiting" | "review" | "done" | "danger" | "soon";
export type BadgeVariant = "soft" | "outline" | "solid";

// Classes écrites en entier pour que Tailwind les détecte. « solid » prend le ton -text en fond
// et la couleur de page en texte : contraste AA dans les deux thèmes (vérifié par contrast.mjs).
export const TONE_CLASSES: Record<Tone, Record<BadgeVariant, string>> = {
  neutral: { soft: "bg-sunken text-ink-2", outline: "border border-line-strong text-ink-2", solid: "bg-ink text-bg" },
  accent: { soft: "bg-accent-soft text-accent", outline: "border border-accent/40 text-accent", solid: "bg-accent text-accent-ink" },
  todo: { soft: "bg-todo-soft text-todo-text", outline: "border border-todo/40 text-todo-text", solid: "bg-todo-text text-bg" },
  progress: { soft: "bg-progress-soft text-progress-text", outline: "border border-progress/40 text-progress-text", solid: "bg-progress text-accent-ink" },
  waiting: { soft: "bg-waiting-soft text-waiting-text", outline: "border border-waiting/40 text-waiting-text", solid: "bg-waiting-text text-bg" },
  review: { soft: "bg-review-soft text-review-text", outline: "border border-review/40 text-review-text", solid: "bg-review-text text-bg" },
  done: { soft: "bg-done-soft text-done-text", outline: "border border-done/40 text-done-text", solid: "bg-done-text text-bg" },
  danger: { soft: "bg-danger-soft text-danger-text", outline: "border border-danger/40 text-danger-text", solid: "bg-danger-text text-bg" },
  soon: { soft: "bg-soon-soft text-soon-text", outline: "border border-soon/40 text-soon-text", solid: "bg-soon-text text-bg" },
};

/**
 * Pastille de libellé : statut, statut de projet, rôle, « Bloqué », « À relancer »…
 * Un seul composant, ton × {doux, contour, plein}.
 */
export function Badge({
  tone = "neutral",
  variant = "soft",
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  variant?: BadgeVariant;
  icon?: React.ReactNode;
}) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone][variant],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
