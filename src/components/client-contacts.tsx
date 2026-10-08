"use client";

import { Check, Pencil, Plus, Star, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { createContact, deleteContact, updateContact, type ContactInput } from "@/app/actions/contacts";
import { fieldClass, GhostButton, labelClass, PrimaryButton } from "@/components/dialog";
import { CopyEmailButton } from "@/components/copy-email-button";

export type ContactRow = {
  id: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
};

/** Interlocuteurs d'un client : liste, ajout, modification, suppression, contact principal. */
export function ClientContacts({ clientId, contacts, legacy }: { clientId: string; contacts: ContactRow[]; legacy: string | null }) {
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [pending, startTransition] = useTransition();

  const save = (id: string | "new", input: ContactInput) =>
    startTransition(async () => {
      const result = id === "new" ? await createContact(clientId, input) : await updateContact(id, input);
      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(id === "new" ? "Contact ajouté" : "Contact enregistré");
      setEditing(null);
    });

  const remove = (contact: ContactRow) =>
    startTransition(async () => {
      await deleteContact(contact.id);
      toast.success(`${contact.name} supprimé`);
    });

  return (
    <div className="mt-3">
      {contacts.length === 0 && legacy && <p className="text-[13px] text-muted">{legacy}</p>}
      {contacts.length > 0 && (
        <ul className="divide-y divide-line rounded-lg border border-line">
          {contacts.map((contact) =>
            editing === contact.id ? (
              <li key={contact.id} className="p-3">
                <ContactForm initial={contact} pending={pending} onSave={(input) => save(contact.id, input)} onCancel={() => setEditing(null)} />
              </li>
            ) : (
              <li key={contact.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]">
                <span className="font-medium">{contact.name}</span>
                {contact.role && <span className="text-muted">{contact.role}</span>}
                {contact.isPrimary && (
                  <span className="inline-flex items-center gap-1 rounded bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent">
                    <Star className="size-3" aria-hidden /> Principal
                  </span>
                )}
                <span className="ml-auto flex items-center gap-1">
                  {contact.email && <CopyEmailButton email={contact.email} />}
                  {contact.phone && <span className="tabular text-[12px] text-muted">{contact.phone}</span>}
                  <button
                    type="button"
                    aria-label={`Modifier ${contact.name}`}
                    onClick={() => setEditing(contact.id)}
                    className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Supprimer ${contact.name}`}
                    disabled={pending}
                    onClick={() => remove(contact)}
                    className="rounded-md p-1.5 text-muted hover:bg-sunken hover:text-danger disabled:opacity-50"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </span>
              </li>
            ),
          )}
        </ul>
      )}

      {editing === "new" ? (
        <div className="mt-2 rounded-lg border border-line p-3">
          <ContactForm pending={pending} onSave={(input) => save("new", input)} onCancel={() => setEditing(null)} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setEditing("new")}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-medium text-accent hover:bg-accent-soft"
        >
          <Plus className="size-3.5" /> Ajouter un contact
        </button>
      )}
    </div>
  );
}

function ContactForm({
  initial,
  pending,
  onSave,
  onCancel,
}: {
  initial?: ContactRow;
  pending: boolean;
  onSave: (input: ContactInput) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<ContactInput>({
    name: initial?.name ?? "",
    role: initial?.role ?? "",
    email: initial?.email ?? "",
    phone: initial?.phone ?? "",
    isPrimary: initial?.isPrimary ?? false,
  });
  const id = initial?.id ?? "new";
  const set = (patch: Partial<ContactInput>) => setForm((current) => ({ ...current, ...patch }));

  return (
    <form
      className="space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(form);
      }}
    >
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label htmlFor={`contact-name-${id}`} className={labelClass}>Nom</label>
          <input id={`contact-name-${id}`} required value={form.name} onChange={(e) => set({ name: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`contact-role-${id}`} className={labelClass}>Rôle</label>
          <input id={`contact-role-${id}`} value={form.role} onChange={(e) => set({ role: e.target.value })} placeholder="Cheffe de projet" className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`contact-email-${id}`} className={labelClass}>Email</label>
          <input id={`contact-email-${id}`} type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} className={fieldClass} />
        </div>
        <div>
          <label htmlFor={`contact-phone-${id}`} className={labelClass}>Téléphone</label>
          <input id={`contact-phone-${id}`} type="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} className={fieldClass} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-[12px] text-ink-2">
        <input type="checkbox" checked={form.isPrimary} onChange={(e) => set({ isPrimary: e.target.checked })} className="accent-[var(--accent)]" />
        Contact principal (salutation des messages au client)
      </label>
      <div className="flex justify-end gap-2">
        <GhostButton type="button" onClick={onCancel}>Annuler</GhostButton>
        <PrimaryButton type="submit" disabled={pending}>
          <Check className="size-4" /> Enregistrer
        </PrimaryButton>
      </div>
    </form>
  );
}
