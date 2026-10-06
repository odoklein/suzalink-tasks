"use client";

import { useActionState } from "react";

import { login } from "@/app/actions/auth";
import { fieldClass, labelClass } from "@/components/dialog";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="mt-8 space-y-4">
      <div>
        <label htmlFor="email" className={labelClass}>Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required autoFocus className={fieldClass} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>Mot de passe</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required className={fieldClass} />
      </div>
      {state?.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-ink py-2.5 text-[14px] font-semibold text-bg transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}
