import { describe, expect, it } from "vitest";

import { changedFields } from "@/lib/events";

describe("changedFields", () => {
  it("liste les champs réellement modifiés, hors statut et attribution", () => {
    const before = { title: "A", zone: "Home", dueDate: new Date("2026-10-08"), status: "TODO", assigneeId: null };
    expect(
      changedFields(before, { title: "A", zone: "Contact", dueDate: new Date("2026-10-08"), status: "DONE", assigneeId: "u1" }),
    ).toEqual(["zone"]);
    expect(changedFields(before, { dueDate: null })).toEqual(["dueDate"]);
  });
});
