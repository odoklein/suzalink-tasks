import { describe, expect, it } from "vitest";

import {
  billableSummary,
  billingCsv,
  buildQuoteMessage,
  canTransition,
  formatEuros,
  parseEuros,
} from "./extras";

describe("extras helpers", () => {
  it("formats and parses euros", () => {
    expect(formatEuros(45000)).toMatch(/450/);
    expect(formatEuros(null)).toBe("");
    expect(parseEuros("150")).toBe(15000);
    expect(parseEuros("150,50")).toBe(15050);
    expect(parseEuros("1 200 €")).toBe(120000);
    expect(parseEuros("invalid")).toBeNull();
  });

  it("checks status transitions", () => {
    expect(canTransition("DRAFT", "QUOTED")).toBe(true);
    expect(canTransition("QUOTED", "APPROVED")).toBe(true);
    expect(canTransition("QUOTED", "REJECTED")).toBe(true);
    expect(canTransition("APPROVED", "INVOICED")).toBe(true);
    expect(canTransition("INVOICED", "PAID")).toBe(true);
    expect(canTransition("DRAFT", "PAID")).toBe(false);
  });

  it("builds billableSummary", () => {
    const tasks = [
      { billable: true, estimatedAmountCents: 15000 },
      { billable: true, estimatedAmountCents: null },
      { billable: false, estimatedAmountCents: null },
    ];
    const summary = billableSummary(tasks);
    expect(summary).toContain("2 hors périmètre");
    expect(summary).toMatch(/150/);
    expect(summary).toContain("1 à chiffrer");
  });

  it("builds quote message", () => {
    const msg = buildQuoteMessage({
      contactFirstName: "Claire",
      projectName: "Bières Georges",
      extraNumber: 1,
      extraTitle: "Bannières",
      items: [{ title: "Bannière promo", zone: "Homepage", amountCents: 15000 }],
      amountCents: 15000,
      senderFirstName: "Odo",
    });
    expect(msg.subject).toContain("avenant n° 1");
    expect(msg.body).toContain("Bonjour Claire,");
    expect(msg.body).toContain("Bannière promo (Homepage)");
    expect(msg.body).toMatch(/150/);
    expect(msg.body).toContain("Odo · Suzali Conseil");
  });

  it("generates billing CSV", () => {
    const csv = billingCsv([
      {
        client: "Bières Georges",
        project: "Refonte site",
        number: 2,
        title: "Bannières Noël",
        amountCents: 45000,
        approvedAt: new Date("2026-10-05T10:00:00Z"),
        approvedBy: "Claire",
      },
    ]);
    expect(csv).toContain("Client;Projet;Avenant;Intitulé;Montant HT (€);Accepté le;Accepté par");
    expect(csv).toContain("Bières Georges;Refonte site;AV-2;Bannières Noël;450,00;05/10/2026;Claire");
  });
});
