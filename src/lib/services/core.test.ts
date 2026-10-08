import { describe, expect, it } from "vitest";

import { parseInput, parseTaskRef, runService, ServiceError } from "@/lib/services/core";
import { newTaskSchema, taskPatchSchema } from "@/lib/validation";

describe("parseTaskRef", () => {
  it("lit une référence, insensible à la casse", () => {
    expect(parseTaskRef("bg-12")).toEqual({ key: "BG", number: 12 });
    expect(parseTaskRef(" SUZ2-7 ")).toEqual({ key: "SUZ2", number: 7 });
  });
  it("refuse ce qui n'est pas une référence", () => {
    expect(parseTaskRef("médailles")).toBeNull();
    expect(parseTaskRef("12-BG")).toBeNull();
  });
});

describe("parseInput", () => {
  it("renvoie un message français lisible", () => {
    expect(() => parseInput(newTaskSchema, { projectId: "p1", title: "   " })).toThrow("Donnez un titre à la tâche.");
  });
  it("nettoie les champs texte", () => {
    const patch = parseInput(taskPatchSchema, { zone: "  Homepage ", description: "   ", assigneeId: "" });
    expect(patch).toEqual({ zone: "Homepage", description: null, assigneeId: null });
  });
  it("refuse un statut inconnu", () => {
    expect(() => parseInput(taskPatchSchema, { status: "LOST" })).toThrow("Statut inconnu.");
  });
  it("refuse une date invalide", () => {
    expect(() => parseInput(taskPatchSchema, { dueDate: "31/02" })).toThrow("Date invalide.");
  });
});

describe("runService", () => {
  it("transforme une ServiceError en { error }", async () => {
    const result = await runService(async () => {
      throw new ServiceError("Tâche introuvable.", "NOT_FOUND");
    });
    expect(result).toEqual({ error: "Tâche introuvable." });
  });
  it("laisse passer les autres erreurs (redirections Next…)", async () => {
    await expect(
      runService(async () => {
        throw new Error("NEXT_REDIRECT");
      }),
    ).rejects.toThrow("NEXT_REDIRECT");
  });
});
