import { beforeEach, describe, expect, it, vi } from "vitest";

// Transaction Prisma simulée : on vérifie les numéros, positions et l'activité.
const tx = {
  project: { update: vi.fn() },
  task: { groupBy: vi.fn(), createManyAndReturn: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  activity: { create: vi.fn() },
  event: { create: vi.fn(), createMany: vi.fn() },
};

vi.mock("@/lib/db", () => ({
  db: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) },
}));

const { createTasks, importFeedback, updateTask } = await import("@/lib/services/tasks");

beforeEach(() => {
  vi.clearAllMocks();
  tx.project.update.mockResolvedValue({ taskCounter: 14, key: "BG" });
  tx.task.groupBy.mockResolvedValue([{ status: "TODO", _max: { position: 5000 } }]);
  tx.task.createManyAndReturn.mockImplementation(({ data }: { data: object[] }) =>
    Promise.resolve(data.map((row, index) => ({ id: `t${index}`, ...row }))),
  );
});

describe("createTasks", () => {
  it("attribue des numéros contigus et des positions croissantes par statut", async () => {
    const actor = { userId: "u1", via: "WEB" as const };
    const { refs } = await createTasks(actor, "p1", [
      { title: "Un" },
      { title: "Deux", status: "DONE" },
      { title: "Trois" },
    ]);
    expect(tx.project.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { taskCounter: { increment: 3 } } }),
    );
    expect(refs).toEqual(["BG-12", "BG-13", "BG-14"]);
    const rows = tx.task.createManyAndReturn.mock.calls[0][0].data;
    expect(rows.map((row: { position: number }) => row.position)).toEqual([6000, 1000, 7000]);
    expect(rows[1].completedAt).toBeInstanceOf(Date);
    expect(tx.activity.create).toHaveBeenCalledTimes(1);
    const events = tx.event.createMany.mock.calls[0][0].data;
    expect(events.map((event: { type: string }) => event.type)).toEqual(["task.created", "task.created", "task.created"]);
    expect(events[0]).toMatchObject({ via: "WEB", actorId: "u1", projectId: "p1", payload: { ref: "BG-12", title: "Un" } });
  });

  it("ne fait rien sans tâche", async () => {
    const result = await createTasks({ userId: "u1", via: "WEB" }, "p1", []);
    expect(result.refs).toEqual([]);
    expect(tx.project.update).not.toHaveBeenCalled();
  });
});

describe("importFeedback", () => {
  it("refuse un collage sans ligne reconnue", async () => {
    await expect(importFeedback({ userId: "u1", via: "WEB" }, "p1", "rien", "")).rejects.toThrow("Aucune ligne reconnue");
  });

  it("crée une tâche par ligne avec une seule activité", async () => {
    tx.project.update.mockResolvedValue({ taskCounter: 2, key: "BG" });
    const text = "Date\tPage\tRetour\tCommentaire\tÉtat\n05/10\tHomepage\tChanger le visuel\t\tPas fait\n05/10\tContact\tAjouter le plan\t\tFait";
    const { count } = await importFeedback({ userId: "u1", via: "WEB" }, "p1", text, "Retours Luna");
    expect(count).toBe(2);
    expect(tx.activity.create.mock.calls[0][0].data.message).toBe("a importé 2 retours (Retours Luna)");
  });
});

describe("updateTask", () => {
  it("écrit les événements de statut, d'attribution et de champs dans la transaction", async () => {
    tx.task.findUnique.mockResolvedValue({
      id: "t1",
      number: 7,
      projectId: "p1",
      status: "TODO",
      assigneeId: null,
      title: "Avant",
      zone: null,
      dueDate: null,
      project: { key: "BG" },
    });
    tx.task.findFirst.mockResolvedValue({ position: 2000 });
    tx.task.update.mockResolvedValue({ id: "t1", title: "Après" });
    await updateTask({ userId: "u1", via: "API" }, "t1", { status: "WAITING_CLIENT", assigneeId: "u2", title: "Après" });
    const types = tx.event.create.mock.calls.map((call) => call[0].data.type);
    expect(types).toEqual(["task.status_changed", "task.assigned", "task.updated"]);
    expect(tx.event.create.mock.calls[0][0].data).toMatchObject({
      via: "API",
      payload: { ref: "BG-7", from: "TODO", to: "WAITING_CLIENT" },
    });
    expect(tx.event.create.mock.calls[2][0].data.payload.fields).toEqual(["title"]);
  });
});
