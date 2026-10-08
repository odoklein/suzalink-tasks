import { TONE_CLASSES, type BadgeVariant, type Tone } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Petite étiquette d’information sur une tâche (page, échéance, hors périmètre, ancienneté).
 * Plus compacte et moins arrondie que Badge ; mêmes tons. `muted` : texte discret sans fond.
 */
export function Chip({
  tone = "neutral",
  variant = "soft",
  muted = false,
  icon,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
  variant?: BadgeVariant;
  muted?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <span
      {...props}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-sm px-1.5 py-0.5 text-meta font-medium",
        muted ? "text-muted" : TONE_CLASSES[tone][variant],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
