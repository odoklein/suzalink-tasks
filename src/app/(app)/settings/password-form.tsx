"use client";

import { useActionState } from "react";

import { changePassword } from "@/app/actions/auth";
import { fieldClass, labelClass, PrimaryButton } from "@/components/dialog";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);

  return (
    <form action={action} className="mt-4 space-y-3">
      <div>
        <label htmlFor="current" className={labelClass}>Mot de passe actuel</label>
        <input id="current" name="current" type="password" autoComplete="current-password" required className={fieldClass} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="next" className={labelClass}>Nouveau mot de passe</label>
          <input id="next" name="next" type="password" autoComplete="new-password" minLength={10} required className={fieldClass} />
        </div>
        <div>
          <label htmlFor="confirm" className={labelClass}>Confirmation</label>
          <input id="confirm" name="confirm" type="password" autoComplete="new-password" minLength={10} required className={fieldClass} />
        </div>
      </div>
      {state?.error && <p role="alert" className="text-[13px] text-danger">{state.error}</p>}
      {state?.success && <p role="status" className="text-[13px] text-st-done">{state.success}</p>}
      <PrimaryButton type="submit" disabled={pending}>{pending ? "Enregistrement…" : "Changer le mot de passe"}</PrimaryButton>
    </form>
  );
}
