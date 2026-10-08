import { describe, expect, it } from "vitest";

import {
  DAY_MS,
  clipIntervals,
  projectWaitingDaysFromTimelines,
  statusIntervals,
  timeInStatusFromIntervals,
  unionLength,
  waitingSinceFor,
  type StatusEvent,
  type TaskTimeline,
} from "@/lib/metrics";

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
const ev = (iso: string, fromStatus: StatusEvent["fromStatus"], toStatus: StatusEvent["toStatus"]): StatusEvent => ({
  at: d(iso),
  fromStatus,
  toStatus,
});
const task = (partial: Partial<TaskTimeline> = {}): TaskTimeline => ({
  createdAt: d("2026-10-01"),
  status: "DONE",
  statusChangedAt: d("2026-10-08"),
  ...partial,
});

describe("waitingSinceFor", () => {
  const now = d("2026-10-08");
  const before = d("2026-10-03");
  it("pose la date à l’entrée chez le client", () => {
    expect(waitingSinceFor("TODO", "WAITING_CLIENT", now, null)).toEqual(now);
  });
  it("conserve la date tant que la tâche y reste", () => {
    expect(waitingSinceFor("WAITING_CLIENT", "WAITING_CLIENT", now, before)).toEqual(before);
  });
  it("efface la date à la sortie", () => {
    expect(waitingSinceFor("WAITING_CLIENT", "IN_PROGRESS", now, before)).toBeNull();
  });
  it("repart de maintenant si l’ancienne date manquait", () => {
    expect(waitingSinceFor("WAITING_CLIENT", "WAITING_CLIENT", now, null)).toEqual(now);
  });
});

describe("statusIntervals / timeInStatus", () => {
  it("découpe une vie de tâche complète", () => {
    const events = [
      ev("2026-10-02", "TODO", "IN_PROGRESS"),
      ev("2026-10-04", "IN_PROGRESS", "WAITING_CLIENT"),
      ev("2026-10-07", "WAITING_CLIENT", "DONE"),
    ];
    const intervals = statusIntervals(task({ statusChangedAt: d("2026-10-07") }), events, d("2026-10-10"));
    expect(intervals.map((i) => [i.status, i.start.getTime(), i.end.getTime()])).toEqual([
      ["TODO", d("2026-10-01").getTime(), d("2026-10-02").getTime()],
      ["IN_PROGRESS", d("2026-10-02").getTime(), d("2026-10-04").getTime()],
      ["WAITING_CLIENT", d("2026-10-04").getTime(), d("2026-10-07").getTime()],
      ["DONE", d("2026-10-07").getTime(), d("2026-10-10").getTime()],
    ]);
    const totals = timeInStatusFromIntervals(intervals);
    expect(totals).toEqual({
      TODO: DAY_MS,
      IN_PROGRESS: 2 * DAY_MS,
      WAITING_CLIENT: 3 * DAY_MS,
      REVIEW: 0,
      DONE: 3 * DAY_MS,
    });
  });

  it("trie les événements désordonnés", () => {
    const events = [ev("2026-10-04", "IN_PROGRESS", "DONE"), ev("2026-10-02", "TODO", "IN_PROGRESS")];
    const totals = timeInStatusFromIntervals(
      statusIntervals(task({ statusChangedAt: d("2026-10-04") }), events, d("2026-10-05")),
    );
    expect(totals.IN_PROGRESS).toBe(2 * DAY_MS);
    expect(totals.DONE).toBe(DAY_MS);
  });

  it("sans événement, ne connaît que le statut actuel", () => {
    const intervals = statusIntervals(
      task({ status: "WAITING_CLIENT", statusChangedAt: d("2026-10-05") }),
      [],
      d("2026-10-08"),
    );
    expect(timeInStatusFromIntervals(intervals).WAITING_CLIENT).toBe(3 * DAY_MS);
    expect(intervals).toHaveLength(1);
  });

  it("ignore la période inconnue avant des lignes rattrapées sans fromStatus", () => {
    const events = [ev("2026-10-03", null, "WAITING_CLIENT"), ev("2026-10-06", null, "DONE")];
    const totals = timeInStatusFromIntervals(
      statusIntervals(task({ statusChangedAt: d("2026-10-06") }), events, d("2026-10-07")),
    );
    expect(totals.TODO).toBe(0);
    expect(totals.WAITING_CLIENT).toBe(3 * DAY_MS);
    expect(totals.DONE).toBe(DAY_MS);
  });

  it("une tâche qui revient chez le client cumule ses attentes", () => {
    const events = [
      ev("2026-10-02", "TODO", "WAITING_CLIENT"),
      ev("2026-10-03", "WAITING_CLIENT", "IN_PROGRESS"),
      ev("2026-10-05", "IN_PROGRESS", "WAITING_CLIENT"),
    ];
    const totals = timeInStatusFromIntervals(
      statusIntervals(task({ status: "WAITING_CLIENT", statusChangedAt: d("2026-10-05") }), events, d("2026-10-08")),
    );
    expect(totals.WAITING_CLIENT).toBe(4 * DAY_MS);
  });
});

describe("clipIntervals / unionLength", () => {
  it("restreint à la fenêtre et supprime ce qui sort", () => {
    const clipped = clipIntervals(
      [
        { status: "WAITING_CLIENT", start: d("2026-10-01"), end: d("2026-10-05") },
        { status: "WAITING_CLIENT", start: d("2026-10-20"), end: d("2026-10-22") },
      ],
      d("2026-10-03"),
      d("2026-10-10"),
    );
    expect(clipped).toHaveLength(1);
    expect(clipped[0].start).toEqual(d("2026-10-03"));
    expect(clipped[0].end).toEqual(d("2026-10-05"));
  });

  it("fusionne les plages qui se chevauchent", () => {
    const range = (a: string, b: string) => ({ start: d(a), end: d(b) });
    expect(unionLength([range("2026-10-01", "2026-10-04"), range("2026-10-03", "2026-10-06")])).toBe(5 * DAY_MS);
    expect(unionLength([range("2026-10-01", "2026-10-02"), range("2026-10-05", "2026-10-07")])).toBe(3 * DAY_MS);
    expect(unionLength([])).toBe(0);
  });
});

describe("projectWaitingDaysFromTimelines", () => {
  it("distingue jours bloqués (union) et jours-tâches (somme)", () => {
    const a = {
      task: task({ status: "DONE", statusChangedAt: d("2026-10-06") }),
      events: [ev("2026-10-02", "TODO", "WAITING_CLIENT"), ev("2026-10-06", "WAITING_CLIENT", "DONE")],
    };
    const b = {
      task: task({ status: "DONE", statusChangedAt: d("2026-10-07") }),
      events: [ev("2026-10-04", "TODO", "WAITING_CLIENT"), ev("2026-10-07", "WAITING_CLIENT", "DONE")],
    };
    const result = projectWaitingDaysFromTimelines([a, b], d("2026-10-01"), d("2026-10-31"), d("2026-10-31"));
    expect(result.taskDays).toBe(7); // 4 + 3
    expect(result.blockedDays).toBe(5); // du 2 au 7
  });

  it("ne compte que la part qui tombe dans la fenêtre", () => {
    const only = {
      task: task({ status: "WAITING_CLIENT", statusChangedAt: d("2026-10-02") }),
      events: [ev("2026-10-02", "TODO", "WAITING_CLIENT")],
    };
    const result = projectWaitingDaysFromTimelines([only], d("2026-10-05"), d("2026-10-08"), d("2026-10-20"));
    expect(result.blockedDays).toBe(3);
  });
});
