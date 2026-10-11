import { describe, expect, it } from "vitest";

import {
  decodeBody,
  extractText,
  header,
  htmlToText,
  isAutomated,
  parseAddressList,
  parseIcs,
  stripQuotedReply,
} from "@/lib/emails/parse";
import { isSenderWorthSuggesting, routeEmail, suggestedClientName } from "@/lib/emails/routing";
import { formatParis } from "@/lib/time";

const b64 = (text: string, encoding: BufferEncoding = "utf8") => Buffer.from(text, encoding).toString("base64url");

describe("adresses et en-têtes", () => {
  it("lit une liste d'adresses, virgules entre guillemets comprises", () => {
    expect(parseAddressList('"Cervi, Luna" <Luna@33degres.fr>, b@y.fr; Marie Dupont <marie@clauzel.fr>, pas-une-adresse')).toEqual([
      { email: "luna@33degres.fr", name: "Cervi, Luna" },
      { email: "b@y.fr", name: null },
      { email: "marie@clauzel.fr", name: "Marie Dupont" },
    ]);
    expect(parseAddressList(null)).toEqual([]);
  });

  it("trouve un en-tête sans tenir compte de la casse", () => {
    expect(header([{ name: "Message-ID", value: "<a@b>" }], "message-id")).toBe("<a@b>");
  });

  it("décode le texte dans son jeu de caractères", () => {
    expect(decodeBody(b64("Échéance mardi"))).toBe("Échéance mardi");
    expect(decodeBody(b64("Échéance", "latin1"), 'text/plain; charset="ISO-8859-1"')).toBe("Échéance");
  });
});

describe("texte du message", () => {
  it("préfère text/plain et ignore les pièces jointes", () => {
    const payload = {
      mimeType: "multipart/mixed",
      parts: [
        { mimeType: "multipart/alternative", parts: [
          { mimeType: "text/plain", body: { data: b64("Bonjour,\r\nvoici nos retours.") } },
          { mimeType: "text/html", body: { data: b64("<p>Bonjour</p>") } },
        ] },
        { mimeType: "text/plain", filename: "notes.txt", body: { data: b64("pièce jointe") } },
      ],
    };
    expect(extractText(payload)).toBe("Bonjour,\nvoici nos retours.");
  });

  it("convertit le HTML en gardant l'adresse des liens", () => {
    const text = htmlToText(
      '<html><head><style>p{}</style></head><body><p>Bonjour&nbsp;Odo,</p><p>On se voit <a href="https://meet.google.com/abc-defg-hij">ici</a> demain.</p><ul><li>Point 1</li></ul></body></html>',
    );
    expect(text).toBe("Bonjour Odo,\nOn se voit ici (https://meet.google.com/abc-defg-hij) demain.\n- Point 1");
  });

  it("retire l'historique cité et la signature", () => {
    expect(stripQuotedReply("Merci, c'est validé.\n\nLe lun. 12 oct. 2026 à 10:00, Odo Klein <odo@suzaliconseil.com> a écrit :\n> Voici la maquette")).toBe(
      "Merci, c'est validé.",
    );
    expect(stripQuotedReply("Ok pour moi.\n\nOn Mon, Oct 12, 2026 at 10:00 AM Odo <odo@x.fr>\nwrote:\n> hello")).toBe("Ok pour moi.");
    expect(stripQuotedReply("Voir ci-dessous.\n\nDe : Luna Cervi\nEnvoyé : lundi 12 octobre\nObjet : maquette")).toBe("Voir ci-dessous.");
    expect(stripQuotedReply("Bonne journée\n-- \nLuna Cervi\n06 00 00 00 00")).toBe("Bonne journée");
    expect(stripQuotedReply("Texte\n\n> cité 1\n> cité 2")).toBe("Texte");
  });
});

describe("e-mails automatiques", () => {
  it("écarte lettres d'information, notifications et catégories Gmail", () => {
    expect(isAutomated({ headers: [], fromEmail: "luna@33degres.fr", labelIds: ["INBOX"] })).toBe(false);
    expect(isAutomated({ headers: [{ name: "List-Unsubscribe", value: "<mailto:x>" }], fromEmail: "news@shop.fr" })).toBe(true);
    expect(isAutomated({ headers: [], fromEmail: "no-reply@github.com" })).toBe(true);
    expect(isAutomated({ headers: [], fromEmail: "notifications+abc@service.io" })).toBe(true);
    expect(isAutomated({ headers: [{ name: "Auto-Submitted", value: "auto-replied" }], fromEmail: "luna@33degres.fr" })).toBe(true);
    expect(isAutomated({ headers: [], fromEmail: "luna@33degres.fr", labelIds: ["CATEGORY_PROMOTIONS"] })).toBe(true);
  });
});

describe("invitations .ics", () => {
  it("lit une invitation avec fuseau, lignes repliées et texte échappé", () => {
    const ics = [
      "BEGIN:VCALENDAR",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      "UID:abc123@google.com",
      "DTSTART;TZID=Europe/Paris:20261013T100000",
      "DTEND;TZID=Europe/Paris:20261013T104500",
      "SUMMARY:Point refonte\\, homepage",
      "DESCRIPTION:Rejoindre : https://meet.google.com/abc-",
      " defg-hij",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const invite = parseIcs(ics);
    expect(invite?.method).toBe("REQUEST");
    expect(invite?.uid).toBe("abc123@google.com");
    expect(invite?.summary).toBe("Point refonte, homepage");
    expect(formatParis(invite!.start, "yyyy-MM-dd HH:mm")).toBe("2026-10-13 10:00");
    expect(invite?.end?.toISOString()).toBe("2026-10-13T08:45:00.000Z");
    expect(invite?.description).toContain("https://meet.google.com/abc-defg-hij");
  });

  it("lit une heure UTC et refuse un fichier sans début", () => {
    expect(parseIcs("BEGIN:VEVENT\nUID:x\nDTSTART:20261013T080000Z\nEND:VEVENT")?.start.toISOString()).toBe("2026-10-13T08:00:00.000Z");
    expect(parseIcs("BEGIN:VEVENT\nUID:x\nEND:VEVENT")).toBeNull();
  });
});

describe("routeEmail", () => {
  const projects = [
    { id: "p1", key: "BG", name: "Bonne Graine", clientId: "c1" },
    { id: "p2", key: "EPH", name: "Ephoto", clientId: "c1" },
    { id: "p3", key: "CLZ", name: "Clauzel", clientId: "c2" },
  ];
  const contacts = [
    { email: "luna@33degres.fr", clientId: "c1" },
    { email: "marie@clauzel.fr", clientId: "c2" },
    { email: "perso@gmail.com", clientId: "c2" },
  ];
  const route = (participants: string[], subject: string, thread: { clientId: string; projectId: string | null } | null = null) =>
    routeEmail({ participants, subject, thread }, contacts, projects);

  it("rattache par contact, puis au projet nommé dans l'objet", () => {
    expect(route(["luna@33degres.fr"], "Retours BG homepage")).toEqual({ clientId: "c1", projectId: "p1", by: "contact" });
    // Deux projets chez ce client, aucun nommé : le client seul.
    expect(route(["luna@33degres.fr"], "Petite question")).toEqual({ clientId: "c1", projectId: null, by: "contact" });
    expect(route(["marie@clauzel.fr"], "Facture")).toEqual({ clientId: "c2", projectId: "p3", by: "contact" });
  });

  it("reconnaît le domaine d'un client, jamais une messagerie grand public", () => {
    expect(route(["paul@clauzel.fr"], "Bonjour")).toEqual({ clientId: "c2", projectId: "p3", by: "domaine" });
    expect(route(["inconnu@gmail.com"], "Bonjour")).toBeNull();
  });

  it("suit le fil de discussion, puis l'objet", () => {
    expect(route(["luna@33degres.fr"], "Re: question", { clientId: "c1", projectId: "p2" })).toEqual({ clientId: "c1", projectId: "p2", by: "fil" });
    expect(route(["x@autre.fr"], "Re: suite", { clientId: "c2", projectId: "p3" })).toEqual({ clientId: "c2", projectId: "p3", by: "fil" });
    expect(route(["x@autre.fr"], "Ephoto : devis")).toEqual({ clientId: "c1", projectId: "p2", by: "titre" });
    expect(route(["x@autre.fr"], "Bonjour")).toBeNull();
  });
});

describe("nouveaux interlocuteurs", () => {
  it("propose seulement ceux avec qui l'agence a vraiment échangé", () => {
    expect(isSenderWorthSuggesting({ received: 2, sent: 1, dismissedAt: null })).toBe(true);
    expect(isSenderWorthSuggesting({ received: 5, sent: 0, dismissedAt: null })).toBe(false);
    expect(isSenderWorthSuggesting({ received: 2, sent: 1, dismissedAt: new Date() })).toBe(false);
  });

  it("nomme le client d'après le domaine", () => {
    expect(suggestedClientName({ email: "paul@atelier-dumas.fr", name: "Paul" })).toBe("Atelier Dumas");
    expect(suggestedClientName({ email: "paul@gmail.com", name: "Paul Martin" })).toBe("Paul Martin");
  });
});
