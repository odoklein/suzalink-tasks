import { describe, expect, it } from "vitest";

import {
  buildRecapText,
  defaultRecapSince,
  recapCounts,
  recapTextToHtml,
  renderRecapText,
  type RecapFacts,
  type RecapTask,
  type ServiceRecapFacts,
} from "@/lib/recap";

const N = " ";
const task = (partial: Partial<RecapTask>): RecapTask => ({
  ref: "BG-1",
  title: "Titre",
  zone: "Accueil",
  status: "DONE",
  billable: false,
  completedAt: "2026-10-06T10:00:00Z",
  waitingSince: null,
  ...partial,
});

const facts = (partial: Partial<RecapFacts> = {}): RecapFacts => ({
  projectName: "Bières Georges",
  siteUrl: "https://bieres.netlify.app",
  clientKind: "DIRECT",
  contactFirstName: "Julien",
  senderFirstName: "Odo",
  lastDeliveryAt: "2026-10-07T13:21:00Z",
  tasks: [
    task({ ref: "BG-1", title: "Logo plus grand" }),
    task({ ref: "BG-2", title: "Ancienne tâche", completedAt: "2026-09-01T10:00:00Z" }),
    task({ ref: "BG-3", title: "Bannière Noël", billable: true }),
    task({ ref: "BG-4", title: "Photos HD", status: "WAITING_CLIENT", completedAt: null, waitingSince: "2026-10-03T10:00:00Z" }),
    task({ ref: "BG-5", title: "Formulaire", status: "REVIEW", completedAt: null }),
    task({ ref: "BG-6", title: "Footer", status: "IN_PROGRESS", completedAt: null }),
  ],
  ...partial,
});

const options = { since: new Date("2026-10-01T00:00:00Z"), whiteLabel: false, includeBillable: true, includeWaiting: true };

describe("buildRecapText", () => {
  it("client direct : salutation, langage simple, pas de statut interne", () => {
    const { text, counts } = buildRecapText(facts(), options);
    expect(text.startsWith("Bonjour Julien,\n")).toBe(true);
    expect(text).toContain(`Dernière mise en ligne le 7 octobre à 15h21${N}: https://bieres.netlify.app.`);
    expect(text).toContain("  - Logo plus grand");
    expect(text).not.toContain("Ancienne tâche");
    expect(text).not.toContain("BG-1");
    expect(text).toContain("  - Formulaire (en cours de finalisation)");
    expect(text).not.toContain("à valider");
    expect(text).toContain("  - Footer\n");
    expect(text).toContain("Photos HD (depuis le 03/10)");
    expect(text.trim().endsWith("Odo · Suzali Conseil")).toBe(true);
    expect(counts).toEqual({ done: 1, billable: 1, waiting: 1, remaining: 2 });
  });

  it("met le hors périmètre dans sa propre section", () => {
    const { text } = buildRecapText(facts(), options);
    const extra = text.indexOf("MODIFICATIONS SUPPLÉMENTAIRES RÉALISÉES");
    expect(extra).toBeGreaterThan(-1);
    expect(text.indexOf("Bannière Noël")).toBeGreaterThan(extra);
    const without = buildRecapText(facts(), { ...options, includeBillable: false }).text;
    expect(without).not.toContain("MODIFICATIONS SUPPLÉMENTAIRES");
    expect(without).toContain("Bannière Noël");
  });

  it("agence : références et statuts, marque blanche sans mention de Suzali", () => {
    const agency = buildRecapText(facts({ clientKind: "AGENCY" }), options).text;
    expect(agency).toContain("  - BG-1 Logo plus grand");
    expect(agency).toContain("BG-5 Formulaire (à valider)");
    expect(agency).toContain("Suzali Conseil");
    const white = buildRecapText(facts({ clientKind: "AGENCY" }), { ...options, whiteLabel: true }).text;
    expect(white).not.toMatch(/suzali/i);
  });

  it("sans contact ni mise en ligne", () => {
    const { text } = buildRecapText(facts({ contactFirstName: null, lastDeliveryAt: null }), { ...options, includeWaiting: false });
    expect(text.startsWith("Bonjour,\n\nVoici le point sur Bières Georges.\n")).toBe(true);
    expect(text).not.toContain("EN ATTENTE");
  });
});

describe("recapTextToHtml", () => {
  it("titres, listes et paragraphes, texte échappé", () => {
    expect(recapTextToHtml("Bonjour,\n\nCE QUI EST FAIT\n\n  - A <b>\n  - B\n\nMerci")).toBe(
      "<p>Bonjour,</p>\n<h3>CE QUI EST FAIT</h3>\n<ul><li>A &lt;b&gt;</li><li>B</li></ul>\n<p>Merci</p>",
    );
  });
});

describe("defaultRecapSince", () => {
  it("prend le dernier récap, sinon la mise en ligne précédant la dernière", () => {
    const recap = new Date("2026-10-02T00:00:00Z");
    const d1 = new Date("2026-10-07T00:00:00Z");
    const d2 = new Date("2026-09-20T00:00:00Z");
    expect(defaultRecapSince(recap, [d1, d2])).toBe(recap);
    expect(defaultRecapSince(null, [d1, d2])).toBe(d2);
    expect(defaultRecapSince(null, [d1])).toBeNull();
  });
});

const serviceFacts: ServiceRecapFacts = {
  project: { id: "p1", name: "Bières Georges", key: "BG", siteUrl: "https://bieres.netlify.app" },
  since: null,
  lastDelivery: { title: "Corrections", deployedAt: new Date("2026-10-07T13:05:00Z"), url: null },
  done: [
    { ref: "BG-1", title: "Retirer l'ombre", zone: "Homepage", status: "DONE", statusChangedAt: new Date() },
    { ref: "BG-2", title: "Changer le logo", zone: null, status: "DONE", statusChangedAt: new Date() },
  ],
  waiting: [{ ref: "BG-3", title: "Visuels HD", zone: "Homepage", status: "WAITING_CLIENT", statusChangedAt: new Date() }],
  remaining: [{ ref: "BG-4", title: "Formulaire", zone: "Contact", status: "IN_PROGRESS", statusChangedAt: new Date() }],
};

describe("renderRecapText", () => {
  const text = renderRecapText(serviceFacts);
  it("donne l'heure de la mise en ligne à Paris", () => {
    expect(text).toContain("Dernière mise en ligne le 7 octobre à 15h05 : https://bieres.netlify.app.");
  });
  it("regroupe par page", () => {
    expect(text).toContain("CE QUI EST FAIT\n\nHomepage\n  - Retirer l'ombre\n\nGénéral\n  - Changer le logo");
    expect(text).toContain("EN ATTENTE DE VOTRE CÔTÉ\n\nHomepage\n  - Visuels HD");
    expect(text).toContain("  - Formulaire (en cours)");
  });
  it("compte les sections", () => {
    expect(recapCounts(serviceFacts)).toEqual({ done: 2, waiting: 1, remaining: 1 });
  });
});
