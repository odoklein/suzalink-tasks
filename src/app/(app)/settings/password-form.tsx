"use client";

import { useActionState } from "react";

import { changePin, type FormState } from "@/app/actions/auth";
import { labelClass } from "@/components/dialog";
import { PinInput } from "@/components/pin-input";
import { Button } from "@/components/ui/button";

type PinState = (FormState & { at?: number }) | undefined;

export function PasswordForm() {
  const [state, action, pending] = useActionState<PinState, FormData>(async (previous, formData) => {
    const result = await changePin(previous, formData);
    return result ? { ...result, at: Date.now() } : result;
  }, undefined);

  // Après chaque essai, les champs repartent à vide.
  const key = state?.at ?? 0;

  return (
    <form action={action} className="mt-5 space-y-4">
      <div className="max-w-[340px]">
        <p className={labelClass}>Code actuel</p>
        <PinInput key={`current-${key}`} name="current" label="Code actuel" size="md" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className={labelClass}>Nouveau code</p>
          <PinInput key={`next-${key}`} name="next" label="Nouveau code" size="md" />
        </div>
        <div>
          <p className={labelClass}>Confirmation</p>
          <PinInput key={`confirm-${key}`} name="confirm" label="Confirmation du nouveau code" size="md" />
        </div>
      </div>
      <p role="status" aria-live="polite" className={`min-h-[1.25rem] text-ui ${state?.error ? "text-danger-text" : "text-done-text"}`}>
        {state?.error ?? state?.success}
      </p>
      <Button type="submit" variant="primary" loading={pending}>{pending ? "Enregistrement…" : "Changer le code"}</Button>
    </form>
  );
}
