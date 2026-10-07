"use client";

import { useRef, useState } from "react";
import { flushSync } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Saisie d'un code à 6 chiffres : avance automatique, retour arrière,
 * collage d'un code entier, et `onComplete` quand le 6ᵉ chiffre est tapé.
 */
export function PinInput({
  name,
  label,
  onComplete,
  invalid = false,
  disabled = false,
  autoFocus = false,
  size = "lg",
}: {
  name: string;
  label: string;
  onComplete?: (pin: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  size?: "lg" | "md";
}) {
  const [digits, setDigits] = useState<string[]>(Array(6).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const update = (next: string[]) => {
    // Le champ caché doit contenir les 6 chiffres AVANT l'envoi automatique :
    // on applique la mise à jour tout de suite, puis on prévient le formulaire.
    flushSync(() => setDigits(next));
    if (next.every(Boolean)) onComplete?.(next.join(""));
  };

  const fillFrom = (index: number, value: string) => {
    const incoming = value.replace(/\D/g, "").slice(0, 6 - index).split("");
    if (incoming.length === 0) return;
    const next = [...digits];
    incoming.forEach((digit, offset) => (next[index + offset] = digit));
    update(next);
    refs.current[Math.min(index + incoming.length, 5)]?.focus();
  };

  return (
    <fieldset className="min-w-0" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <input type="hidden" name={name} value={digits.join("")} />
      <div className={cn("flex gap-2", invalid && "animate-shake")}>
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            value={digit}
            autoFocus={autoFocus && index === 0}
            inputMode="numeric"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${label}, chiffre ${index + 1} sur 6`}
            maxLength={6}
            onFocus={(event) => event.target.select()}
            onChange={(event) => fillFrom(index, event.target.value)}
            onPaste={(event) => {
              event.preventDefault();
              fillFrom(0, event.clipboardData.getData("text"));
            }}
            onKeyDown={(event) => {
              if (event.key === "Backspace") {
                event.preventDefault();
                const next = [...digits];
                if (next[index]) {
                  next[index] = "";
                } else if (index > 0) {
                  next[index - 1] = "";
                  refs.current[index - 1]?.focus();
                }
                setDigits(next);
              } else if (event.key === "ArrowLeft" && index > 0) {
                refs.current[index - 1]?.focus();
              } else if (event.key === "ArrowRight" && index < 5) {
                refs.current[index + 1]?.focus();
              }
            }}
            className={cn(
              "tabular w-full min-w-0 rounded-xl border bg-surface text-center font-mono font-semibold text-ink caret-accent outline-none transition-[border-color,box-shadow,transform]",
              "focus:border-accent focus:shadow-[0_0_0_4px_var(--accent-soft)]",
              size === "lg" ? "h-14 text-[22px]" : "h-11 text-[18px]",
              digit ? "border-line-strong" : "border-line",
              invalid && "border-danger focus:border-danger",
            )}
          />
        ))}
      </div>
    </fieldset>
  );
}
