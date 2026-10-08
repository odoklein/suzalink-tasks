"use client";

import { forwardRef, useId } from "react";

import { cn } from "@/lib/utils";

type Size = "md" | "lg";

const control =
  "w-full border bg-surface-2 text-ink outline-hidden placeholder:text-faint transition-[border-color,background-color,box-shadow] duration-[var(--dur-1)] " +
  "focus-visible:border-accent focus-visible:bg-surface focus-visible:shadow-[var(--ring)] " +
  "disabled:cursor-not-allowed disabled:opacity-45 aria-invalid:border-danger " +
  // 16 px minimum sur écran tactile : sinon iOS zoome à la prise de focus.
  "pointer-coarse:text-[16px]";

const sizes = {
  input: { md: "h-8 rounded-md px-3 text-ui", lg: "h-10 rounded-md px-3.5 text-body" } satisfies Record<Size, string>,
  textarea: { md: "min-h-16 rounded-md px-3 py-2 text-ui", lg: "min-h-20 rounded-md px-3.5 py-2.5 text-body" } satisfies Record<Size, string>,
};

/** Variante « en ligne » : invisible tant qu’on ne survole pas ni ne focalise (tiroir de tâche). */
const inline =
  "border-transparent bg-transparent hover:bg-sunken focus-visible:border-accent focus-visible:bg-surface";

type FieldProps = {
  size?: Size;
  /** Message d’erreur : met le champ en état invalide et le relie au champ (aria-describedby). */
  error?: string;
  /** Aide sous le champ. */
  hint?: string;
  variant?: "default" | "inline";
};

function Message({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={id} role="alert" className="mt-1 text-xs text-danger-text">
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={id} className="mt-1 text-xs text-muted">
      {hint}
    </p>
  ) : null;
}

export const Input = forwardRef<HTMLInputElement, Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & FieldProps>(
  function Input({ size = "md", error, hint, variant = "default", className, ...props }, ref) {
    const messageId = useId();
    const described = error || hint ? messageId : undefined;
    return (
      <div className="w-full">
        <input
          {...props}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(props["aria-describedby"], described) || undefined}
          className={cn(control, sizes.input[size], variant === "inline" && inline, className)}
        />
        <Message id={messageId} error={error} hint={hint} />
      </div>
    );
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps>(
  function Textarea({ size = "md", error, hint, variant = "default", className, ...props }, ref) {
    const messageId = useId();
    const described = error || hint ? messageId : undefined;
    return (
      <div className="w-full">
        <textarea
          {...props}
          ref={ref}
          aria-invalid={error ? true : undefined}
          aria-describedby={cn(props["aria-describedby"], described) || undefined}
          className={cn(control, sizes.textarea[size], "resize-none leading-relaxed", variant === "inline" && inline, className)}
        />
        <Message id={messageId} error={error} hint={hint} />
      </div>
    );
  },
);

/** Libellé + champ : relie le label au contrôle sans que l’appelant gère les id. */
export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: (id: string) => React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-ink-2">
        {label}
      </label>
      {children(id)}
    </div>
  );
}
