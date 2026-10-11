"use client";

import { Plus, UserPlus, X } from "lucide-react";
import { useState } from "react";

import { addSenderToClient, createClientFromSender, dismissSenderAction } from "@/app/actions/emails";
import { Dialog } from "@/components/dialog";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { SelectMenu } from "@/components/select-menu";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { plural } from "@/lib/plural";

/**
 * Interlocuteur inconnu avec qui l'agence a échangé : l'ajouter comme contact
 * d'un client (existant ou nouveau), ou l'ignorer. Ses e-mails récents sont
 * alors relus et rattachés.
 */
export function SenderSuggestion({
  sender,
  clients,
}: {
  sender: { email: string; name: string | null; received: number; sent: number; suggestedName: string };
  clients: { id: string; name: string }[];
}) {
  const { pending, run } = useMeetingAction();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState(sender.suggestedName);
  const who = sender.name ?? sender.email;

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
      <span className="min-w-0 flex-1 basis-56">
        <span className="block truncate text-body font-medium">{who}</span>
        <span className="block truncate text-meta text-muted">
          {sender.name ? `${sender.email} · ` : ""}
          {plural(sender.received, "reçu", "reçus")}, {plural(sender.sent, "envoyé", "envoyés")}
        </span>
      </span>
      <span className="flex flex-wrap items-center gap-2" aria-busy={pending || undefined}>
        <SelectMenu<string>
          label={`Ajouter ${who} au client`}
          searchable
          value={null}
          onChange={(clientId) => run(() => addSenderToClient(sender.email, clientId), `${who} ajouté aux contacts`)}
          options={clients.map((client) => ({ value: client.id, label: client.name }))}
          trigger={
            <>
              <UserPlus className="size-4 text-muted" aria-hidden="true" />
              <span>Ajouter à un client</span>
            </>
          }
        />
        <Button size="sm" icon={<Plus className="size-3.5" />} onClick={() => setCreating(true)} disabled={pending}>
          Nouveau client
        </Button>
        <Button size="sm" variant="ghost" icon={<X className="size-3.5" />} onClick={() => run(() => dismissSenderAction(sender.email))} disabled={pending}>
          Ignorer
        </Button>
      </span>

      <Dialog
        open={creating}
        onClose={() => setCreating(false)}
        title="Créer le client"
        description={`${who} en devient le contact principal ; ses e-mails des 30 derniers jours y seront rattachés.`}
        footer={
          <>
            <Button onClick={() => setCreating(false)}>Annuler</Button>
            <Button
              variant="primary"
              type="submit"
              form={`client-${sender.email}`}
              loading={pending}
              disabled={!name.trim()}
            >
              Créer le client
            </Button>
          </>
        }
      >
        <form
          id={`client-${sender.email}`}
          onSubmit={(event) => {
            event.preventDefault();
            run(() => createClientFromSender(sender.email, name), `Client ${name.trim()} créé`, () => setCreating(false));
          }}
        >
          <Field label="Nom du client">{(id) => <Input id={id} value={name} onChange={(event) => setName(event.target.value)} maxLength={120} autoFocus />}</Field>
        </form>
      </Dialog>
    </li>
  );
}
