import { describe, expect, it } from "vitest";
import { parseFeedbackTable, parseTsv, statusFromLabel } from "@/lib/feedback-import";

const HEADER = "Date\tPage\tRetour\tCommentaire\tÉtat";

describe("parseTsv", () => {
  it("garde les cellules multilignes et les guillemets doublés", () => {
    const rows = parseTsv('a\t"ligne 1\nligne 2 ""citée"""\tc');
    expect(rows).toEqual([["a", 'ligne 1\nligne 2 "citée"', "c"]]);
  });

  it("gère les fins de ligne CRLF", () => {
    expect(parseTsv("a\tb\r\nc\td\r\n")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("supprime les lignes vides", () => {
    expect(parseTsv("a\tb\n\n \t \nc\td")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });
});

describe("statusFromLabel", () => {
  it.each([
    ["Fait", "DONE"],
    ["Pas fait", "TODO"],
    ["À refaire", "TODO"],
    ["En attente client", "WAITING_CLIENT"],
    ["À valider", "REVIEW"],
    ["En cours", "IN_PROGRESS"],
    ["", "TODO"],
    [undefined, "TODO"],
  ])("%s → %s", (label, status) => {
    expect(statusFromLabel(label)).toBe(status);
  });
});

describe("parseFeedbackTable", () => {
  it("reconnaît l’en-tête standard", () => {
    const rows = parseFeedbackTable(
      `${HEADER}\n08/10/2026\tAccueil\tRetirer l'ombre\tVu avec le client\tFait`,
    );
    expect(rows).toEqual([
      {
        title: "Retirer l'ombre",
        zone: "Accueil",
        description: "Vu avec le client",
        status: "DONE",
        date: "08/10/2026",
      },
    ]);
  });

  it("« Pas fait » + commentaire « en attente » donne WAITING_CLIENT", () => {
    const [row] = parseFeedbackTable(
      `${HEADER}\n\tAccueil\tNouveau logo\ten attente des visuels client\tPas fait`,
    );
    expect(row.status).toBe("WAITING_CLIENT");
  });

  it("accepte les fins de ligne CRLF", () => {
    const rows = parseFeedbackTable(`${HEADER}\r\n\tA\tUn\t\tFait\r\n\tB\tDeux\t\tPas fait\r\n`);
    expect(rows.map((r) => r.title)).toEqual(["Un", "Deux"]);
  });

  it("ignore les lignes vides et celles sans retour", () => {
    const rows = parseFeedbackTable(`${HEADER}\n\n\tA\t\tcommentaire seul\tFait\n\tB\tDeux\t\tFait`);
    expect(rows.map((r) => r.title)).toEqual(["Deux"]);
  });

  it("tronque un titre trop long et place le texte complet en description", () => {
    const long = "x".repeat(200);
    const [row] = parseFeedbackTable(`${HEADER}\n\tA\t${long}\t\tFait`);
    expect(row.title).toHaveLength(178);
    expect(row.title.endsWith("…")).toBe(true);
    expect(row.description).toBe(long);
  });

  it("sans en-tête, suppose Date, Page, Retour, Commentaire, État", () => {
    const [row] = parseFeedbackTable("08/10\tAccueil\tCorriger\tnote\tFait");
    expect(row).toMatchObject({ title: "Corriger", zone: "Accueil", status: "DONE" });
  });

  it("renvoie une liste vide pour un texte vide", () => {
    expect(parseFeedbackTable("")).toEqual([]);
  });
});
