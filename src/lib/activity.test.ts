import { describe, expect, it } from "vitest";

import { describeActivity } from "@/lib/activity-copy";
import { classifyLegacyActivity } from "@/lib/activity-legacy";
import { diffTask, type TrackedTask } from "@/lib/task-changes";

const N = " ";
const base: TrackedTask = {
  title: "Retirer l’ombre",
  status: "TODO",
  priority: "NONE",
  billable: false,
  dueDate: null,
  assigneeId: null,
};
const people = new Map([
  ["u1", { id: "u1", name: "Odo" }],
  ["u2", { id: "u2", name: "Anaïs" }],
]);

describe("describeActivity", () => {
  it("garde de→à et les statuts structurés pour un changement de statut", () => {
    const row = describeActivity({ type: "STATUS_CHANGED", ref: "BG-12", from: "TODO", to: "DONE" });
    expect(row).toMatchObject({ type: "STATUS_CHANGED", fromStatus: "TODO", toStatus: "DONE" });
    expect(row.message).toBe(`a passé BG-12 de «${N}À faire${N}» à «${N}Fait${N}»`);
  });

  it("rend l’attribution, la réattribution et le retrait", () => {
    const odo = { id: "u1", name: "Odo" };
    const anais = { id: "u2", name: "Anaïs" };
    expect(describeActivity({ type: "ASSIGNED", ref: "BG-1", from: null, to: odo }).message).toBe("a attribué BG-1 à Odo");
    expect(describeActivity({ type: "ASSIGNED", ref: "BG-1", from: odo, to: anais }).message).toBe(
      `a réattribué BG-1 à Anaïs (avant${N}: Odo)`,
    );
    expect(describeActivity({ type: "ASSIGNED", ref: "BG-1", from: odo, to: null }).message).toBe(
      `a retiré l’attribution de BG-1 (avant${N}: Odo)`,
    );
  });

  it("rend le hors périmètre dans les deux sens", () => {
    expect(describeActivity({ type: "BILLABLE_CHANGED", ref: "BG-1", from: false, to: true }).message).toBe(
      "a marqué BG-1 hors périmètre (€)",
    );
    expect(describeActivity({ type: "BILLABLE_CHANGED", ref: "BG-1", from: true, to: false }).message).toBe(
      "a retiré BG-1 du hors périmètre (€)",
    );
  });

  it("rend les échéances en heure de Paris, avec des valeurs ISO dans data", () => {
    // 22:30 UTC le 8 octobre = 00:30 le 9 octobre à Paris.
    const row = describeActivity({
      type: "DUE_CHANGED",
      ref: "BG-1",
      from: null,
      to: new Date("2026-10-08T22:30:00Z"),
    });
    expect(row.message).toBe("a fixé l’échéance de BG-1 au 9 oct. 2026");
    expect(row.data).toEqual({ ref: "BG-1", from: null, to: "2026-10-08T22:30:00.000Z" });
  });

  it("rend la priorité et le titre", () => {
    expect(describeActivity({ type: "PRIORITY_CHANGED", ref: "BG-1", from: "NONE", to: "URGENT" }).message).toBe(
      `a changé la priorité de BG-1${N}: aucune → urgente`,
    );
    expect(describeActivity({ type: "TITLE_CHANGED", ref: "BG-1", from: "A", to: "B" }).message).toBe(
      `a renommé BG-1${N}: «${N}A${N}» → «${N}B${N}»`,
    );
  });

  it("accorde les imports et signale les mises à jour", () => {
    expect(describeActivity({ type: "IMPORTED", created: 1 }).message).toBe("a importé 1 retour");
    expect(describeActivity({ type: "IMPORTED", created: 18, updated: 4, source: "Retours Luna 06/10" }).message).toBe(
      "a importé 18 retours, mis à jour 4 tâches existantes (Retours Luna 06/10)",
    );
  });

  it("rend les changements de statut de projet de→à", () => {
    const row = describeActivity({ type: "PROJECT_UPDATED", change: "status", from: "ACTIVE", to: "DONE" });
    expect(row.message).toBe(`a passé le projet de «${N}En cours${N}» à «${N}Livré${N}»`);
    expect(row.type).toBe("PROJECT_UPDATED");
  });
});

describe("diffTask", () => {
  it("ne renvoie rien quand rien ne change", () => {
    expect(diffTask("BG-1", base, { ...base }, people)).toEqual([]);
  });

  it("renvoie un événement par champ modifié, dans un ordre stable", () => {
    const events = diffTask(
      "BG-1",
      base,
      {
        ...base,
        status: "IN_PROGRESS",
        assigneeId: "u1",
        billable: true,
        dueDate: new Date("2026-10-12T00:00:00Z"),
        priority: "HIGH",
        title: "Autre titre",
      },
      people,
    );
    expect(events.map((e) => e.type)).toEqual([
      "STATUS_CHANGED",
      "ASSIGNED",
      "BILLABLE_CHANGED",
      "DUE_CHANGED",
      "PRIORITY_CHANGED",
      "TITLE_CHANGED",
    ]);
  });

  it("compare les dates par valeur et non par référence", () => {
    const a = { ...base, dueDate: new Date("2026-10-12T00:00:00Z") };
    const b = { ...base, dueDate: new Date("2026-10-12T00:00:00Z") };
    expect(diffTask("BG-1", a, b, people)).toEqual([]);
  });

  it("résout les noms pour une réattribution", () => {
    const [event] = diffTask("BG-1", { ...base, assigneeId: "u1" }, { ...base, assigneeId: "u2" }, people);
    expect(event).toMatchObject({ type: "ASSIGNED", from: { name: "Odo" }, to: { name: "Anaïs" } });
  });
});

describe("classifyLegacyActivity", () => {
  it.each([
    ["a passé BG-12 en « Fait »", { type: "STATUS_CHANGED", toStatus: "DONE" }],
    ["a passé BG-12 en « En attente client »", { type: "STATUS_CHANGED", toStatus: "WAITING_CLIENT" }],
    ["a réassigné BG-12", { type: "ASSIGNED" }],
    ["a commenté BG-12", { type: "COMMENTED" }],
    ["a supprimé BG-12 « Un titre »", { type: "TASK_DELETED" }],
    ["a créé BG-12 « Un titre »", { type: "TASK_CREATED" }],
    ["a créé le projet", { type: "PROJECT_UPDATED" }],
    ["a importé 18 retours (Retours Luna)", { type: "IMPORTED" }],
    ["a enregistré une mise en ligne : Corrections", { type: "DELIVERED" }],
    ["a changé le statut du projet", { type: "PROJECT_UPDATED" }],
    ["a mis à jour le point d'étape", { type: "PROJECT_UPDATED" }],
  ])("%s", (message, expected) => {
    expect(classifyLegacyActivity(message)).toEqual(expected);
  });

  it("reconnaît aussi les messages écrits avec des espaces insécables", () => {
    expect(classifyLegacyActivity(`a passé BG-1 en «${N}Fait${N}»`)).toEqual({ type: "STATUS_CHANGED", toStatus: "DONE" });
  });

  it("renvoie null pour un message inconnu", () => {
    expect(classifyLegacyActivity("autre chose")).toBeNull();
  });
});
