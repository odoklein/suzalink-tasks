import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";

export type ButtonVariant = "primary" | "accent" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const base =
  "relative inline-flex shrink-0 select-none items-center justify-center whitespace-nowrap font-medium outline-hidden " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-[var(--dur-1)] " +
  "active:scale-[.98] focus-visible:shadow-[var(--ring)] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-ink hover:bg-primary/90",
  accent: "bg-accent text-accent-ink hover:bg-accent/90",
  secondary: "border border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
  ghost: "text-ink-2 hover:bg-sunken hover:text-ink",
  danger: "bg-danger text-accent-ink hover:bg-danger/90",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-7 gap-1.5 rounded-sm px-2.5 text-xs",
  md: "h-8 gap-2 rounded-md px-3 text-ui",
  lg: "h-10 gap-2 rounded-md px-4 text-body",
  icon: "size-8 rounded-md",
};

/** Classes d’un bouton, pour styler un <Link> comme un bouton. */
export function buttonClass({
  variant = "secondary",
  size = "md",
  className,
}: { variant?: ButtonVariant; size?: ButtonSize; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={cn("size-4 animate-spin", className)}>
      <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M8 2a6 6 0 0 1 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Icône avant le libellé ; remplacée par un spinner pendant `loading`. */
  icon?: React.ReactNode;
  /** Action en cours : désactive le bouton et garde sa largeur. */
  loading?: boolean;
};

/**
 * Bouton unique de l’application. Avec `loading`, l’icône (ou, à défaut, le contenu
 * rendu invisible) est remplacée par un spinner : la largeur ne bouge pas.
 */
export function Button({
  variant = "secondary",
  size = "md",
  icon,
  loading = false,
  disabled,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const overlaySpinner = loading && !icon;
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonClass({ variant, size, className })}
    >
      {icon && (loading ? <Spinner className="size-[1em] shrink-0" /> : icon)}
      {overlaySpinner && <Spinner className="absolute" />}
      {children != null && <span className={cn("inline-flex items-center gap-[inherit]", overlaySpinner && "invisible")}>{children}</span>}
    </button>
  );
}

/**
 * Bouton réduit à une icône. `label` est obligatoire : c’est le nom accessible et
 * l’infobulle. Zone cliquable d’au moins 24 px, 44 px sur écran tactile.
 */
export function IconButton({
  label,
  shortcut,
  variant = "ghost",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: Omit<ButtonProps, "icon" | "loading" | "size"> & {
  label: string;
  shortcut?: string;
  size?: "sm" | "md";
}) {
  return (
    <Tooltip content={label} shortcut={shortcut}>
      <button
        {...props}
        type={type}
        aria-label={label}
        className={cn(
          base,
          variants[variant],
          size === "sm" ? "size-6 rounded-sm" : "size-7 rounded-md",
          "pointer-coarse:after:absolute pointer-coarse:after:-inset-2",
          className,
        )}
      >
        {children}
      </button>
    </Tooltip>
  );
}
