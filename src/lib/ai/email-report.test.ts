import { describe, expect, it } from "vitest";

import { buildEmailPrompt, checkEmailReport, checkProposedMeeting, emailReportSchema, type ModelEmailReport } from "@/lib/ai/email-report";

const body = `Bonjour Odo,

Merci pour la maquette. Pouvez-vous remplacer la photo du bandeau par celle de l'équipe ?
Je vous envoie les textes de la page À propos jeudi.

On peut en parler demain à 10h : https://meet.google.com/abc-defg-hij

Luna`;

// E-mail envoyé le lundi 12 octobre 2026 à 9 h (Paris) ; analyse le même jour.
const sentAt = new Date("2026-10-12T07:00:00Z");
const context = {
  body,
  openTasks: [{ id: "t-12", ref: "BG-12", zone: "Homepage", title: "Changer le visuel principal" }],
  zones: ["Homepage", "À propos"],
  team: [{ id: "u-odo", name: "Odo Klein" }],
  sentAt,
  now: new Date("2026-10-12T08:00:00Z"),
};

const action = (over: Partial<ModelEmailReport["actions"][number]>): ModelEmailReport["actions"][number] => ({
  title: "Remplacer la photo du bandeau",
  description: null,
  basis: "REQUESTED",
  quote: "remplacer la photo du bandeau par celle de l'équipe",
  owner: null,
  due: null,
  zone: "homepage",
  duplicateOf: "BG-12",
  ...over,
});

describe("checkEmailReport", () => {
  it("garde les actions dont la citation est dans l'e-mail", () => {
    const checked = checkEmailReport(
      {
        summary: "Le client demande une nouvelle photo et propose un point demain.",
        actions: [
          action({}),
          action({ title: "Recevoir les textes À propos", basis: "COMMITTED", quote: "Je vous envoie les textes de la page À propos jeudi", owner: "Luna", due: "jeudi", zone: "À propos", duplicateOf: null }),
          action({ title: "Refaire tout le site", quote: "refaites tout le site en rouge", duplicateOf: null }),
        ],
        meeting: { url: "https://meet.google.com/abc-defg-hij", startsAt: "2026-10-13T10:00:00+02:00", endsAt: null },
      },
      context,
    );
    expect(checked.dropped).toBe(1);
    expect(checked.proposals.map((proposal) => proposal.title)).toEqual(["Remplacer la photo du bandeau", "Recevoir les textes À propos"]);
    expect(checked.proposals[0]).toMatchObject({ zone: "Homepage", duplicateOfId: "t-12" });
    expect(checked.proposals[1].suggestedDue?.toISOString()).toBe("2026-10-14T22:00:00.000Z"); // jeudi 15, minuit à Paris
    expect(checked.meeting).toMatchObject({ link: { platform: "GOOGLE_MEET", nativeMeetingId: "abc-defg-hij" } });
    expect(checked.meeting?.startsAt.toISOString()).toBe("2026-10-13T08:00:00.000Z");
    expect(checked.meeting?.endsAt.toISOString()).toBe("2026-10-13T08:30:00.000Z");
  });
});

describe("checkProposedMeeting", () => {
  const meeting = { url: null, startsAt: "2026-10-13T10:00:00+02:00", endsAt: "2026-10-13T11:00:00+02:00" };

  it("prend le lien dans l'e-mail, jamais celui de l'IA", () => {
    expect(checkProposedMeeting({ ...meeting, url: "https://zoom.us/j/12345678901" }, body, context.now)?.link.platform).toBe("GOOGLE_MEET");
    expect(checkProposedMeeting(meeting, "Pas de lien ici.", context.now)).toBeNull();
  });

  it("refuse une heure sans fuseau, passée ou trop lointaine", () => {
    expect(checkProposedMeeting({ ...meeting, startsAt: "2026-10-13T10:00:00" }, body, context.now)).toBeNull();
    expect(checkProposedMeeting({ ...meeting, startsAt: "2026-10-01T10:00:00+02:00" }, body, context.now)).toBeNull();
    expect(checkProposedMeeting({ ...meeting, startsAt: "2027-06-01T10:00:00+02:00" }, body, context.now)).toBeNull();
    expect(checkProposedMeeting(null, body, context.now)).toBeNull();
  });

  it("garde une fin plausible, sinon 30 minutes", () => {
    expect(checkProposedMeeting(meeting, body, context.now)?.endsAt.toISOString()).toBe("2026-10-13T09:00:00.000Z");
    expect(checkProposedMeeting({ ...meeting, endsAt: "2026-10-12T09:00:00+02:00" }, body, context.now)?.endsAt.toISOString()).toBe("2026-10-13T08:30:00.000Z");
  });
});

describe("prompt et schéma", () => {
  it("met l'e-mail entre balises, avec le contexte du projet", () => {
    const prompt = buildEmailPrompt({ subject: "Maquette", from: "Luna Cervi <luna@33degres.fr>", sentAt, projectName: "Bonne Graine", zones: context.zones, openTasks: context.openTasks, body });
    expect(prompt).toContain("Envoyé le : lundi 12 octobre 2026 à 09h00");
    expect(prompt).toContain("BG-12 | Homepage");
    expect(prompt.trim().endsWith("</email>")).toBe(true);
    expect(emailReportSchema.safeParse({ summary: "", actions: [], meeting: null }).success).toBe(true);
  });
});
