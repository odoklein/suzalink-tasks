import { describe, expect, it } from "vitest";

import {
  addDaysParis,
  DEFAULT_TEMPLATES,
  formatTemplateTasks,
  parseEstimate,
  parseTemplateTasks,
  planFromTemplate,
} from "@/lib/templates";

describe("parseTemplateTasks / formatTemplateTasks", () => {
  it("lit « Titre | Page | Jalon | J+3 | 2h »", () => {
    expect(parseTemplateTasks("Maquette | Accueil | Maquettes | J+7 | 1j\n\nRecette |  |  | +3\nSeul titre")).toEqual([
      { title: "Maquette", zone: "Accueil", milestone: "Maquettes", offsetDays: 7, estimateMin: 420 },
      { title: "Recette", zone: null, milestone: null, offsetDays: 3, estimateMin: null },
      { title: "Seul titre", zone: null, milestone: null, offsetDays: null, estimateMin: null },
    ]);
  });

  it("aller-retour texte → données → texte", () => {
    const text = "Maquette | Accueil | Maquettes | J+7 | 1j\nRecette |  |  | J+3\nSeul titre";
    expect(formatTemplateTasks(parseTemplateTasks(text))).toBe(text);
  });

  it("lit les estimations", () => {
    expect(parseEstimate("2h")).toBe(120);
    expect(parseEstimate("30m")).toBe(30);
    expect(parseEstimate("1,5h")).toBe(90);
    expect(parseEstimate("45")).toBe(45);
    expect(parseEstimate("bientôt")).toBeNull();
  });
});

describe("planFromTemplate", () => {
  it("échéances relatives au démarrage, en jours de calendrier à Paris", () => {
    const start = new Date("2026-10-20T22:00:00Z"); // 21 octobre, minuit à Paris (UTC+2)
    // Le 25 octobre on passe à UTC+1 : J+7 = 28 octobre minuit à Paris = 23:00 UTC la veille.
    expect(addDaysParis(start, 7).toISOString()).toBe("2026-10-27T23:00:00.000Z");
    const plan = planFromTemplate(DEFAULT_TEMPLATES[0], start);
    expect(plan.tasks).toHaveLength(10);
    expect(plan.tasks[0].dueDate?.toISOString()).toBe(start.toISOString());
    expect(plan.zones).toContain("Accueil");
    const maquettes = plan.milestones.find((m) => m.name === "Maquettes");
    expect(maquettes?.dueDate?.toISOString()).toBe(addDaysParis(start, 12).toISOString());
  });

  it("ajoute les pages et jalons cités seulement par les tâches", () => {
    const plan = planFromTemplate(
      { name: "X", type: "OTHER", milestones: [], zones: [], tasks: parseTemplateTasks("A | Blog | Lancement") },
      new Date("2026-10-01T00:00:00Z"),
    );
    expect(plan.zones).toEqual(["Blog"]);
    expect(plan.milestones.map((m) => m.name)).toEqual(["Lancement"]);
  });

  it("fournit 3 modèles", () => {
    expect(DEFAULT_TEMPLATES.map((t) => t.name)).toEqual(["Site vitrine", "E-commerce", "Réseaux sociaux"]);
    for (const template of DEFAULT_TEMPLATES) expect(template.tasks.every((task) => task.title)).toBe(true);
  });
});
