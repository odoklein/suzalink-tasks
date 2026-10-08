"use client";

import { useActionState, useRef, useState, useSyncExternalStore } from "react";

import { login } from "@/app/actions/auth";
import { PinInput } from "@/components/pin-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const labelClass = "mb-2 block text-body font-medium text-ink";

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
          <div className="flex items-center justify-between gap-3 rounded-md bg-surface-2 px-3 py-2.5">
            <span className="truncate text-body">{knownEmail}</span>
            <Button variant="ghost" size="sm" onClick={() => setChanging(true)} className="shrink-0 text-accent">
              Changer
            </Button>
          </div>
          <input type="hidden" name="email" value={knownEmail} />
        </div>
      ) : (
        <div>
          <label htmlFor="email" className={labelClass}>Votre email</label>
          <Input
            id="email"
            name="email"
            type="email"
            size="lg"
            autoComplete="username"
            required
            autoFocus
            placeholder="prenom@suzaliconseil.com"
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
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2.5 text-body text-danger-text">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" size="lg" loading={pending} className="w-full font-semibold">
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}
