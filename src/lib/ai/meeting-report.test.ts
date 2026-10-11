import { describe, expect, it } from "vitest";

import {
  buildReportPrompt,
  checkReport,
  locateQuote,
  matchMember,
  reportJsonSchema,
  reportSchema,
  type ModelReport,
  type TranscriptLine,
} from "@/lib/ai/meeting-report";

// Extrait d'une réunion fictive (lundi 12 octobre 2026, 11 h à Paris).
const lines: TranscriptLine[] = [
  { index: 0, speaker: "Luna Cervi", startMs: 0, text: "Bonjour à tous, merci d'être là." },
  { index: 1, speaker: "Luna Cervi", startMs: 4_000, text: "Sur la homepage, le visuel principal ne va pas, il faut le remplacer par la photo de l'équipe." },
  { index: 2, speaker: "Odo Klein", startMs: 12_000, text: "D'accord, je m'en occupe, je vous envoie une proposition jeudi." },
  { index: 3, speaker: "Luna Cervi", startMs: 20_000, text: "Et il nous manque encore les textes de la page À propos," },
  { index: 4, speaker: "Luna Cervi", startMs: 24_000, text: "je vous les fais parvenir la semaine prochaine." },
  { index: 5, speaker: "Hichem", startMs: 30_000, text: "On pourrait aussi revoir le pied de page." },
];

const team = [
  { id: "u-odo", name: "Odo Klein" },
  { id: "u-hichem", name: "Hichem" },
  { id: "u-odile", name: "Odile Martin" },
];

const context = {
  lines,
  openTasks: [{ id: "t-12", ref: "BG-12", zone: "Homepage", title: "Changer le visuel principal" }],
  zones: ["Homepage", "À propos"],
  team,
  startsAt: new Date("2026-10-12T09:00:00Z"),
};

const action = (overrides: Partial<ModelReport["actions"][number]>): ModelReport["actions"][number] => ({
  title: "Remplacer le visuel principal",
  description: null,
  basis: "REQUESTED",
  quote: "il faut le remplacer par la photo de l'équipe",
  segments: [1],
  owner: null,
  due: null,
  zone: "homepage",
  duplicateOf: null,
  ...overrides,
});

describe("locateQuote", () => {
  it("vérifie la citation dans les passages cités, sans tenir compte des accents ni de la ponctuation", () => {
    expect(locateQuote("il faut le REMPLACER par la photo de l’equipe", [1], lines)).toEqual([1]);
  });

  it("retrouve une citation mal numérotée, ou à cheval sur deux passages", () => {
    expect(locateQuote("je vous envoie une proposition jeudi", [5], lines)).toEqual([2]);
    expect(locateQuote("les textes de la page À propos, je vous les fais parvenir", [], lines)).toEqual([3, 4]);
  });

  it("écarte une citation inventée ou trop courte", () => {
    expect(locateQuote("le client veut une boutique en ligne", [1], lines)).toBeNull();
    expect(locateQuote("jeudi", [2], lines)).toBeNull();
  });
});

describe("matchMember", () => {
  it("reconnaît un prénom ou un nom complet sans ambiguïté", () => {
    expect(matchMember("Odo", team)).toBe("u-odo");
    expect(matchMember("odo klein", team)).toBe("u-odo");
    expect(matchMember("Hichem", team)).toBe("u-hichem");
    expect(matchMember("l'équipe Suzali", team)).toBeNull();
    expect(matchMember(null, team)).toBeNull();
  });
});

describe("checkReport", () => {
  it("garde les actions prouvées, résout dates, pages, membres et doublons", () => {
    const report: ModelReport = {
      summary: "  Le client veut changer le visuel principal. ",
      decisions: ["Garder la structure de la homepage", " "],
      openQuestions: ["Textes de la page À propos"],
      actions: [
        action({ duplicateOf: "bg-12" }),
        action({
          title: "Envoyer une proposition de visuel",
          basis: "COMMITTED",
          quote: "je vous envoie une proposition jeudi",
          segments: [2],
          owner: "Odo",
          due: "jeudi",
          zone: "Contact",
        }),
        action({
          title: "Obtenir les textes de la page À propos",
          basis: "COMMITTED",
          quote: "je vous les fais parvenir la semaine prochaine",
          segments: [4],
          owner: "Luna",
          due: "la semaine prochaine",
          zone: "à propos",
        }),
        action({ title: "Créer une boutique", quote: "le client veut une boutique en ligne", segments: [0] }),
      ],
    };
    const checked = checkReport(report, context);

    expect(checked.dropped).toBe(1);
    expect(checked.summary).toBe("Le client veut changer le visuel principal.");
    expect(checked.decisions).toEqual(["Garder la structure de la homepage"]);
    expect(checked.proposals).toHaveLength(3);

    const [visual, proposal, texts] = checked.proposals;
    expect(visual).toMatchObject({ zone: "Homepage", duplicateOfId: "t-12", position: 0 });
    expect(proposal).toMatchObject({ suggestedUserId: "u-odo", dueText: "jeudi", zone: null, basis: "COMMITTED" });
    expect(proposal.suggestedDue?.toISOString()).toBe("2026-10-14T22:00:00.000Z"); // jeudi 15, minuit à Paris
    // Échéance ambiguë et personne hors de l'équipe : le texte reste, rien n'est deviné.
    expect(texts).toMatchObject({ ownerText: "Luna", suggestedUserId: null, dueText: "la semaine prochaine", suggestedDue: null, zone: "À propos" });
  });

  it("raccourcit les titres trop longs et ignore une référence inconnue", () => {
    const checked = checkReport(
      { summary: "", decisions: [], openQuestions: [], actions: [action({ title: "A".repeat(200), duplicateOf: "XX-99" })] },
      context,
    );
    expect(checked.proposals[0].title).toHaveLength(120);
    expect(checked.proposals[0].duplicateOfId).toBeNull();
  });
});

describe("prompt et schéma", () => {
  it("numérote la transcription et liste les tâches ouvertes", () => {
    const prompt = buildReportPrompt({
      title: "Point refonte",
      startsAt: context.startsAt,
      projectName: "Bonne Graine",
      zones: context.zones,
      openTasks: context.openTasks,
      attendees: ["Luna Cervi"],
      lines: lines.slice(0, 2),
    });
    expect(prompt).toContain("lundi 12 octobre 2026 à 11h00");
    expect(prompt).toContain("BG-12 | Homepage | Changer le visuel principal");
    expect(prompt).toContain("[1] Luna Cervi (00:04) : Sur la homepage");
    expect(prompt.trim().endsWith("</transcription>")).toBe(true);
  });

  it("décrit la réponse attendue en JSON Schema, que zod sait relire", () => {
    expect(reportJsonSchema).toMatchObject({ type: "object", required: ["summary", "decisions", "openQuestions", "actions"] });
    expect(reportSchema.safeParse({ summary: "x", decisions: [], openQuestions: [], actions: [] }).success).toBe(true);
  });
});
