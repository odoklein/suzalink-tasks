"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";

import { login } from "@/app/actions/auth";
import { fieldClass, labelClass } from "@/components/dialog";
import { PinInput } from "@/components/pin-input";

const STORAGE_KEY = "suzali:last-email";

// Email mémorisé sur cet appareil : la prochaine fois, seul le code est demandé.
function readRemembered() {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

type LoginState = { error?: string; at?: number } | undefined;

export function LoginForm() {
  const form = useRef<HTMLFormElement>(null);
  const remembered = useSyncExternalStore(
    () => () => {},
    readRemembered,
    () => "",
  );
  const [changing, setChanging] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(async (previous, formData) => {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    try {
      if (email) localStorage.setItem(STORAGE_KEY, email);
    } catch {
      // stockage indisponible (navigation privée) : on continue sans mémoriser
    }
    const result = await login(previous, formData);
    return result ? { ...result, at: Date.now() } : result;
  }, undefined);

  const knownEmail = remembered && !changing ? remembered : "";

  return (
    <form ref={form} action={action} className="mt-8 space-y-5">
      {knownEmail ? (
        <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-3 shadow-card">
          <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft font-display text-[13px] font-bold uppercase text-accent">
            {knownEmail[0]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] text-muted">Connexion en tant que</p>
            <p className="truncate text-[14px] font-medium">{knownEmail}</p>
          </div>
          <button type="button" onClick={() => setChanging(true)} className="text-[12px] font-medium text-accent hover:underline">
            Changer
          </button>
          <input type="hidden" name="email" value={knownEmail} />
        </div>
      ) : (
        <div>
          <label htmlFor="email" className={labelClass}>Email</label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            autoFocus
            defaultValue={changing ? "" : remembered}
            placeholder="prenom@suzaliconseil.com"
            className={fieldClass}
          />
        </div>
      )}

      <div>
        <p className={labelClass}>Code PIN</p>
        <PinInput
          key={state?.at ?? 0}
          name="pin"
          label="Code PIN"
          invalid={Boolean(state?.error)}
          disabled={pending}
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

      <p role="alert" aria-live="polite" className="min-h-[1.25rem] text-[13px] text-danger">
        {state?.error}
      </p>

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-ink py-3 text-[14px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
