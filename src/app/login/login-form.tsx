"use client";

import { Loader2 } from "lucide-react";
import { useActionState, useRef, useState, useSyncExternalStore } from "react";

import { login } from "@/app/actions/auth";
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

type LoginState = { error?: string; at?: number } | undefined;

const labelClass = "mb-2 block text-[14px] font-medium text-ink";

export function LoginForm() {
  const form = useRef<HTMLFormElement>(null);
  const remembered = useSyncExternalStore(() => () => {}, readRemembered, () => "");
  const [changing, setChanging] = useState(false);
  const [state, action, pending] = useActionState<LoginState, FormData>(async (previous, formData) => {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    try {
      if (email) localStorage.setItem(STORAGE_KEY, email);
    } catch {
      // navigation privée : on continue sans retenir l'email
    }
    const result = await login(previous, formData);
    return result ? { ...result, at: Date.now() } : result;
  }, undefined);

  const knownEmail = remembered && !changing ? remembered : "";

  return (
    <form ref={form} action={action} className="space-y-5">
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

      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2.5 text-[14px] text-danger">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-[15px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending && <Loader2 className="size-4 animate-spin" />}
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
