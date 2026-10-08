"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";

import { login, type LoginState as ServerLoginState } from "@/app/actions/auth";
import { fieldClass } from "@/components/dialog";
import { PinInput } from "@/components/pin-input";

const STORAGE_KEY = "suzali:last-email";

// Email retenu sur cet appareil : la prochaine fois, seul le code est demandé.
function readRemembered() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

type LoginState = (NonNullable<ServerLoginState> & { at?: number }) | undefined;

/** Millisecondes restantes avant `until` (0 si passé), rafraîchi chaque seconde. */
function useRemaining(until: string | undefined) {
  const [now, setNow] = useState(() => Date.now());
  const end = until ? new Date(until).getTime() : 0;
  useEffect(() => {
    if (!end) return;
    const timer = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= end) clearInterval(timer);
    }, 1000);
    return () => clearInterval(timer);
  }, [end]);
  return Math.max(0, end - now);
}

/** « 14 min 05 s », « 59 s », « 23 h 59 min ». */
function formatCountdown(ms: number) {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")} min`;
  if (minutes > 0) return `${minutes} min ${String(seconds).padStart(2, "0")} s`;
  return `${seconds} s`;
}

const labelClass = "mb-2 block text-[14px] font-medium text-ink";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const form = useRef<HTMLFormElement>(null);
  const remembered = useSyncExternalStore(() => () => {}, readRemembered, () => "");
  const [changing, setChanging] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(async (previous, formData) => {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const result = await login(previous, formData);
    if (result?.next) {
      // On ne retient l'email qu'après une connexion réussie (pas une faute de frappe).
      try {
        if (email) localStorage.setItem(STORAGE_KEY, email);
      } catch {
        // navigation privée : on continue sans retenir l'email
      }
      router.replace(result.next);
      return result;
    }
    return result ? { ...result, at: Date.now() } : result;
  }, undefined);

  const knownEmail = remembered && !changing ? remembered : "";
  const remaining = useRemaining(state?.lockedUntil);
  const locked = remaining > 0;
  // Une fois le blocage terminé, l'ancien message « Trop d'erreurs » n'a plus lieu d'être.
  const error = state?.lockedUntil && !locked ? undefined : state?.error;

  return (
    <form ref={form} action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      {knownEmail ? (
        <div>
          <p className={labelClass}>Votre email</p>
          <div className="flex items-center justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2.5">
            <span className="truncate text-[15px]">{knownEmail}</span>
            <button type="button" onClick={() => setChanging(true)} className="shrink-0 text-[13px] font-medium text-accent hover:underline">
              Changer
            </button>
          </div>
          <input type="hidden" name="email" value={knownEmail} />
        </div>
      ) : (
        <div>
          <label htmlFor="email" className={labelClass}>Votre email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            placeholder="prenom@suzaliconseil.com"
            className={`${fieldClass} py-2.5 text-[15px]`}
          />
        </div>
      )}

      <div>
        <p className={labelClass}>Votre code (6 chiffres)</p>
        <PinInput
          key={state?.at ?? 0}
          name="pin"
          label="Votre code"
          invalid={Boolean(error)}
          disabled={pending || locked}
          autoFocus={Boolean(knownEmail)}
          onComplete={() => {
            const email = form.current?.querySelector<HTMLInputElement>('[name="email"]');
            if (email && !email.value) {
              email.focus();
              return;
            }
            form.current?.requestSubmit();
          }}
        />
      </div>

      {error && (
        <div className="rounded-lg bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          <p role="alert">{error}</p>
          {locked && (
            // Compte à rebours visuel seulement : le message ci-dessus est déjà annoncé une fois.
            <p aria-hidden className="tabular mt-1 text-[13px]">
              Nouvel essai possible dans {formatCountdown(remaining)}
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || locked || Boolean(state?.next)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {(pending || state?.next) && <Loader2 className="size-4 animate-spin" />}
        {pending || state?.next ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
