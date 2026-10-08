"use client";

import { Check, Copy, KeyRound, UserPlus } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { addMember, resetMemberPin, setMemberActive, type MemberState } from "@/app/actions/team";
import { fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { Avatar } from "@/components/primitives";

export type Member = {
  id: string;
  name: string;
  email: string;
  color: string;
  role: "ADMIN" | "MEMBER";
  active: boolean;
  openTasks: number;
  locked: boolean;
};

type Issued = { name: string; pin: string };

export function TeamSection({ members, currentUserId }: { members: Member[]; currentUserId: string }) {
  const [issued, setIssued] = useState<Issued | null>(null);
  const [pendingReset, startTransition] = useTransition();
  const [formKey, setFormKey] = useState(0);

  const [state, action, pending] = useActionState<MemberState, FormData>(async (previous, formData) => {
    const result = await addMember(previous, formData);
    if (result?.pin && result.name) {
      setIssued({ name: result.name, pin: result.pin });
      setFormKey((key) => key + 1);
    }
    return result;
  }, undefined);

  const reset = (member: Member) =>
    startTransition(async () => {
      const result = await resetMemberPin(member.id);
      if (result?.error) toast.error(result.error);
      else if (result?.pin) setIssued({ name: member.name, pin: result.pin });
    });

  const toggleActive = (member: Member) =>
    startTransition(async () => {
      const result = await setMemberActive(member.id, !member.active);
      if (result?.error) toast.error(result.error);
      else toast.success(member.active ? `Compte de ${member.name} désactivé, sessions fermées` : `Compte de ${member.name} réactivé`);
    });

  return (
    <div className="mt-4">
      {issued && <IssuedPin issued={issued} onClose={() => setIssued(null)} />}

      <ul className="divide-y divide-line rounded-lg border border-line">
        {members.map((member) => (
          <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
            <Avatar name={member.name} color={member.color} size={28} />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-[13px] font-medium">
                {member.name}
                {member.id === currentUserId && <span className="ml-1.5 text-[11px] font-normal text-faint">vous</span>}
              </p>
              <p className="truncate text-[12px] text-muted">{member.email}</p>
            </div>
            {!member.active && <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-muted">Désactivé</span>}
            {member.locked && <span className="rounded-full bg-danger-soft px-2 py-0.5 text-[11px] font-medium text-danger">Bloqué</span>}
            <span className="hidden text-[12px] text-muted sm:inline">
              {member.openTasks} tâche{member.openTasks > 1 ? "s" : ""}
            </span>
            <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2">
              {member.role === "ADMIN" ? "Admin" : "Membre"}
            </span>
            {member.id !== currentUserId && (
              <button
                type="button"
                disabled={pendingReset}
                onClick={() => reset(member)}
                title="Générer un nouveau code (code oublié ou compte bloqué)"
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:bg-sunken hover:text-ink disabled:opacity-50"
              >
                <KeyRound className="size-3.5" />
                <span className="hidden sm:inline">Nouveau code</span>
              </button>
            )}
            {member.id !== currentUserId && (
              <ActiveToggle member={member} disabled={pendingReset} onConfirm={() => toggleActive(member)} />
            )}
          </li>
        ))}
      </ul>

      <form key={formKey} action={action} className="mt-4 rounded-lg border border-dashed border-line-strong p-4">
        <p className="flex items-center gap-2 text-[13px] font-semibold">
          <UserPlus className="size-4 text-muted" /> Ajouter un membre
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto]">
          <div>
            <label htmlFor="member-name" className={labelClass}>Nom</label>
            <input id="member-name" name="name" required autoComplete="off" placeholder="Prénom Nom" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="member-email" className={labelClass}>Email</label>
            <input id="member-email" name="email" type="email" required autoComplete="off" placeholder="prenom@suzaliconseil.com" className={fieldClass} />
          </div>
          <div>
            <label htmlFor="member-role" className={labelClass}>Rôle</label>
            <select id="member-role" name="role" defaultValue="MEMBER" className={fieldClass}>
              <option value="MEMBER">Membre</option>
              <option value="ADMIN">Admin</option>
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <PrimaryButton type="submit" disabled={pending}>{pending ? "Création…" : "Créer le compte"}</PrimaryButton>
          <p role="status" aria-live="polite" className="text-[12px] text-danger">{state?.error}</p>
        </div>
        <p className="mt-2 text-[12px] text-muted">Un code à 6 chiffres est généré et affiché une seule fois : transmettez-le à la personne, elle le changera dans Paramètres.</p>
      </form>
    </div>
  );
}

/** Désactiver demande une confirmation (deuxième clic) ; réactiver est immédiat. */
function ActiveToggle({ member, disabled, onConfirm }: { member: Member; disabled: boolean; onConfirm: () => void }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 3500);
    return () => clearTimeout(timer);
  }, [armed]);
  const confirm = () => {
    setArmed(false);
    onConfirm();
  };
  if (!member.active) {
    return (
      <button type="button" disabled={disabled} onClick={onConfirm} className="rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:bg-sunken hover:text-ink disabled:opacity-50">
        Réactiver
      </button>
    );
  }
  return armed ? (
    <button type="button" disabled={disabled} onClick={confirm} className="rounded-md bg-danger px-2 py-1 text-[12px] font-semibold text-white disabled:opacity-50">
      Confirmer
    </button>
  ) : (
    <button
      type="button"
      disabled={disabled}
      onClick={() => setArmed(true)}
      title="Le compte ne pourra plus se connecter ; ses sessions sont fermées."
      className="rounded-md px-2 py-1 text-[12px] font-medium text-muted hover:bg-danger-soft hover:text-danger disabled:opacity-50"
    >
      Désactiver
    </button>
  );
}

function IssuedPin({ issued, onClose }: { issued: Issued; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(issued.pin);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Copie impossible : notez le code à la main.");
    }
  };
  return (
    <div role="status" className="animate-pop-in mb-4 flex flex-wrap items-center gap-4 rounded-lg border border-accent/40 bg-accent-soft px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] text-ink-2">Code de {issued.name} : affiché une seule fois</p>
        <p className="tabular mt-0.5 font-mono text-[26px] font-semibold tracking-[0.3em]">{issued.pin}</p>
      </div>
      <div className="flex gap-2">
        <GhostButton type="button" onClick={copy}>
          {copied ? <Check className="size-4 text-st-done" /> : <Copy className="size-4" />}
          {copied ? "Copié" : "Copier"}
        </GhostButton>
        <GhostButton type="button" onClick={onClose}>Fermer</GhostButton>
      </div>
    </div>
  );
}
