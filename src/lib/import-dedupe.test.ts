import { describe, expect, it } from "vitest";

import {
  columnLetter,
  detectTable,
  looksLikeTable,
  parseFeedbackRows,
  parseFeedbackTable,
  parseSheetDate,
} from "@/lib/feedback-import";
import { importKey, normalizeKeyPart } from "@/lib/import-key";
import {
  classifyRows,
  classificationLabel,
  countModes,
  defaultMode,
  importButtonLabel,
  resolveMode,
  type ExistingMatch,
} from "@/lib/import-plan";
import { planImportWrites } from "@/lib/import-writes";

const HEADER = "Date\tPage\tRetour\tCommentaire\tÉtat";

describe("importKey", () => {
  it("ignore la casse, les accents, la ponctuation et les espaces", () => {
    const a = importKey("Fiche produit", "Retirer l'ombre sur l’image !");
    const b = importKey("  fiche   PRODUIT ", "retirer l’ombre sur l'image");
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{40}$/);
  });

  it("distingue deux pages ou deux retours différents", () => {
    expect(importKey("Accueil", "Logo")).not.toBe(importKey("Contact", "Logo"));
    expect(importKey("Accueil", "Logo")).not.toBe(importKey("Accueil", "Logo en haut"));
  });

  it("normalise sans page", () => {
    expect(importKey(undefined, "Logo")).toBe(importKey("", "Logo"));
    expect(normalizeKeyPart("Éé  Ça !")).toBe("ee ca");
  });
});

describe("détection des colonnes", () => {
  it("reconnaît l’en-tête standard", () => {
    const { mapping, ambiguous } = detectTable(`${HEADER}\n05/10\tAccueil\tLogo\t\tFait`);
    expect(mapping).toEqual({ hasHeader: true, date: 0, page: 1, retour: 2, etat: 4, comments: [3] });
    expect(ambiguous).toBe(false);
  });

  it("reconnaît les synonymes : écran, demande, statut", () => {
    const { mapping, ambiguous } = detectTable("Écran\tDemande\tStatut\nAccueil\tLogo\tFait");
    expect(mapping).toMatchObject({ hasHeader: true, page: 0, retour: 1, etat: 2 });
    expect(ambiguous).toBe(false);
  });

  it("prend « Commentaire client » comme retour quand il n’y a pas d’autre colonne de retour", () => {
    const { mapping } = detectTable("Page\tCommentaire client\tÉtat\nAccueil\tLogo\tFait");
    expect(mapping).toMatchObject({ page: 0, retour: 1, etat: 2, comments: [] });
  });

  it("reconnaît « Modification »", () => {
    const { mapping } = detectTable("Page\tModification\nAccueil\tLogo");
    expect(mapping.retour).toBe(1);
  });

  it("signale l’ambiguïté sans en-tête reconnu", () => {
    const { mapping, ambiguous, headers } = detectTable("05/10\tAccueil\tLogo\tnote\tFait");
    expect(ambiguous).toBe(true);
    expect(mapping).toMatchObject({ hasHeader: false, date: 0, page: 1, retour: 2, etat: 4, comments: [3] });
    expect(headers).toEqual(["Colonne A", "Colonne B", "Colonne C", "Colonne D", "Colonne E"]);
  });

  it("n’ajoute pas la colonne État aux commentaires sans en-tête", () => {
    const [row] = parseFeedbackTable("05/10\tAccueil\tLogo\tnote\tFait");
    expect(row.description).toBe("note");
    expect(row.status).toBe("DONE");
  });

  it("applique une affectation choisie dans le mappeur", () => {
    const detected = detectTable("A\tB\tC\nx\tAccueil\tLogo");
    const rows = parseFeedbackRows(detected.rows, { hasHeader: true, date: -1, page: 1, retour: 2, etat: -1, comments: [] });
    expect(rows).toEqual([{ title: "Logo", zone: "Accueil", description: undefined, status: "TODO", date: undefined }]);
  });

  it("nomme les colonnes comme un tableur", () => {
    expect([0, 1, 25, 26, 27].map(columnLetter)).toEqual(["A", "B", "Z", "AA", "AB"]);
  });
});

describe("looksLikeTable", () => {
  it("accepte un collage de tableur", () => {
    expect(looksLikeTable(`${HEADER}\n05/10\tAccueil\tLogo\t\tFait`)).toBe(true);
  });
  it("refuse du texte ordinaire ou une seule ligne", () => {
    expect(looksLikeTable("Bonjour, voici le logo")).toBe(false);
    expect(looksLikeTable("a\tb")).toBe(false);
    expect(looksLikeTable("a\nb\nc")).toBe(false);
  });
});

describe("parseSheetDate", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  it("lit jj/MM, jj/MM/aaaa et aaaa-MM-jj à minuit Paris", () => {
    expect(parseSheetDate("05/10", now)?.toISOString()).toBe("2026-10-04T22:00:00.000Z");
    expect(parseSheetDate("5/10/2026", now)?.toISOString()).toBe("2026-10-04T22:00:00.000Z");
    expect(parseSheetDate("2026-01-12", now)?.toISOString()).toBe("2026-01-11T23:00:00.000Z");
  });
  it("sans année, retombe sur l’année précédente si la date est dans le futur", () => {
    expect(parseSheetDate("20/12", now)?.toISOString()).toBe("2025-12-19T23:00:00.000Z");
  });
  it("refuse une date inexistante ou du texte", () => {
    expect(parseSheetDate("31/02", now)).toBeNull();
    expect(parseSheetDate("bientôt", now)).toBeNull();
    expect(parseSheetDate("", now)).toBeNull();
  });
});

const existing = (status: ExistingMatch["status"], ref = "BG-14"): ExistingMatch => ({ id: "t1", ref, status, title: "Logo" });

describe("classification et plan d’import", () => {
  const rows = [
    { key: "k-new", status: "TODO" as const },
    { key: "k-same", status: "DONE" as const },
    { key: "k-changed", status: "TODO" as const },
    { key: "k-new", status: "TODO" as const },
  ];
  const byKey = new Map([
    ["k-same", existing("DONE", "BG-1")],
    ["k-changed", existing("DONE", "BG-2")],
  ]);
  const classes = classifyRows(rows, byKey);

  it("classe nouvelle, déjà importée, état modifié et doublon dans le collage", () => {
    expect(classes.map((c) => c.kind)).toEqual(["new", "existing", "existing", "paste-duplicate"]);
    expect(classes[1]).toMatchObject({ statusChanged: false });
    expect(classes[2]).toMatchObject({ statusChanged: true });
    expect(classes[3]).toMatchObject({ ofIndex: 0 });
  });

  it("propose créer / ignorer / mettre à jour / ignorer", () => {
    expect(classes.map(defaultMode)).toEqual(["create", "skip", "update", "skip"]);
  });

  it("n’accepte jamais un mode incompatible avec la ligne", () => {
    expect(resolveMode("create", classes[1])).toBe("skip"); // déjà importée : pas de doublon silencieux
    expect(resolveMode("update", classes[0])).toBe("skip"); // rien à mettre à jour
    expect(resolveMode("force", classes[1])).toBe("force");
    expect(resolveMode(undefined, classes[2])).toBe("update");
  });

  it("libelle les badges", () => {
    expect(classificationLabel(classes[0], "TODO")).toBe("Nouvelle");
    expect(classificationLabel(classes[1], "DONE")).toBe("Déjà importée (BG-1)");
    expect(classificationLabel(classes[2], "TODO")).toBe("État modifié : Fait → À faire");
    expect(classificationLabel(classes[3], "TODO")).toBe("Doublon dans le collage");
  });

  it("libelle le bouton", () => {
    expect(importButtonLabel({ create: 18, update: 4, skip: 0 })).toBe("Créer 18 tâches · mettre à jour 4");
    expect(importButtonLabel({ create: 1, update: 0, skip: 3 })).toBe("Créer 1 tâche");
    expect(importButtonLabel({ create: 0, update: 4, skip: 0 })).toBe("Mettre à jour 4");
    expect(importButtonLabel({ create: 0, update: 0, skip: 9 })).toBe("Rien à importer");
    expect(countModes(["create", "force", "update", "skip", "skip"])).toEqual({ create: 2, update: 1, skip: 2 });
  });
});

describe("planImportWrites", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  const parsed = parseFeedbackTable(
    [
      HEADER,
      "05/10\tAccueil\tLogo\t\tPas fait",
      "05/10\tAccueil\tBannière\t\tFait",
      "05/10\tContact\tFormulaire\ten attente des textes\tPas fait",
      "05/10\tContact\tCarte\t\tPas fait",
    ].join("\n"),
  );
  const keys = parsed.map((row) => importKey(row.zone, row.title));
  const base = {
    rows: parsed,
    keys,
    maxPositions: { TODO: 3000, DONE: 500 },
    source: "Retours du 05/10",
    now,
  };

  it("sur une base vide, crée tout, sans position en double", () => {
    const classifications = classifyRows(parsed.map((row, i) => ({ key: keys[i], status: row.status })), new Map());
    const writes = planImportWrites({ ...base, classifications });
    expect(writes.creates).toHaveLength(4);
    expect(writes.creates.map((c) => c.externalKey)).toEqual(keys);
    const todo = writes.creates.filter((c) => c.status === "TODO").map((c) => c.position);
    expect(todo).toEqual([4000, 5000]); // à la suite de 3000
    expect(new Set(writes.creates.map((c) => `${c.status}:${c.position}`)).size).toBe(4);
    expect(writes.creates.find((c) => c.status === "WAITING_CLIENT")?.waitingSince).toEqual(now);
    expect(writes.creates.find((c) => c.status === "DONE")?.completedAt).toEqual(now);
  });

  it("re-coller le même tableau ne crée aucune tâche", () => {
    const byKey = new Map(
      parsed.map((row, i) => [keys[i], existing(row.status, `BG-${i + 1}`)] as const).map(([k, m], i) => [k, { ...m, id: `t${i}` }] as const),
    );
    const classifications = classifyRows(parsed.map((row, i) => ({ key: keys[i], status: row.status })), byKey);
    const writes = planImportWrites({ ...base, classifications });
    expect(writes.creates).toHaveLength(0);
    expect(writes.updates).toHaveLength(0);
    expect(writes.skipped).toBe(4);
  });

  it("une seule cellule d’état modifiée propose exactement une mise à jour", () => {
    const byKey = new Map(
      parsed.map((row, i) => [keys[i], { ...existing(row.status, `BG-${i + 1}`), id: `t${i}` }] as const),
    );
    // La tâche « Logo » est « Fait » dans l'appli alors que le tableau dit « Pas fait » : l'état a changé.
    byKey.set(keys[0], { ...existing("DONE", "BG-1"), id: "t0" });
    const classifications = classifyRows(parsed.map((row, i) => ({ key: keys[i], status: row.status })), byKey);
    const writes = planImportWrites({
      ...base,
      classifications,
      existingState: new Map([["t0", { completedAt: new Date("2026-10-01T00:00:00Z"), waitingSince: null }]]),
    });
    expect(writes.creates).toHaveLength(0);
    expect(writes.updates).toEqual([
      { taskId: "t0", ref: "BG-1", from: "DONE", to: "TODO", position: 4000, completedAt: null, waitingSince: null },
    ]);
  });

  it("« Créer quand même » n’écrit pas de clé ; modifier page, titre et état dans l’aperçu est pris en compte", () => {
    // La ligne 0 existe déjà : « Créer quand même » est le seul moyen de la recréer.
    const classifications = classifyRows(
      parsed.map((row, i) => ({ key: keys[i], status: row.status })),
      new Map([[keys[0], existing("TODO", "BG-1")]]),
    );
    const writes = planImportWrites({
      ...base,
      classifications,
      overrides: [
        { index: 0, mode: "force", zone: " Header ", status: "IN_PROGRESS", title: "Nouveau  logo" },
        { index: 1, mode: "skip" },
      ],
      defaults: { assigneeId: "u1", priority: "HIGH", dueDate: new Date("2026-10-12T00:00:00Z") },
    });
    expect(writes.creates).toHaveLength(3);
    expect(writes.skipped).toBe(1);
    expect(writes.creates[0]).toMatchObject({
      externalKey: null,
      zone: "Header",
      status: "IN_PROGRESS",
      title: "Nouveau logo",
      assigneeId: "u1",
      priority: "HIGH",
    });
  });
});
