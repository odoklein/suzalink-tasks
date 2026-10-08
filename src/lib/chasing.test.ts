import { describe, expect, it } from "vitest";

import {
  buildChaseMessage,
  chaseDueAt,
  chaseLabel,
  chaseState,
  mailtoLink,
  needsChase,
  type WaitingTask,
} from "@/lib/chasing";

const N = " ";
const d = (iso: string) => new Date(iso);
const task = (partial: Partial<WaitingTask> = {}): WaitingTask => ({
  status: "WAITING_CLIENT",
  statusChangedAt: d("2026-10-01T09:00:00Z"),
  waitingSince: d("2026-10-01T09:00:00Z"),
  lastChasedAt: null,
  followUpAt: null,
  ...partial,
});

describe("règle « à relancer »", () => {
  it("devient à relancer 5 jours après l’entrée chez le client", () => {
    expect(needsChase(task(), d("2026-10-06T08:59:00Z"))).toBe(false);
    expect(needsChase(task(), d("2026-10-06T09:00:00Z"))).toBe(true);
  });

  it("une relance repousse l’échéance de 5 jours", () => {
    const chased = task({ lastChasedAt: d("2026-10-07T10:00:00Z") });
    expect(needsChase(chased, d("2026-10-10T10:00:00Z"))).toBe(false);
    expect(needsChase(chased, d("2026-10-12T10:00:00Z"))).toBe(true);
  });

  it("se rabat sur statusChangedAt pour les anciennes tâches", () => {
    const legacy = task({ waitingSince: null, statusChangedAt: d("2026-09-20T00:00:00Z") });
    expect(needsChase(legacy, d("2026-10-01T00:00:00Z"))).toBe(true);
  });

  it("respecte une date de relance choisie à la main", () => {
    const manual = task({ followUpAt: d("2026-10-03T07:00:00Z") });
    expect(chaseDueAt(manual)).toEqual(d("2026-10-03T07:00:00Z"));
    expect(needsChase(manual, d("2026-10-03T08:00:00Z"))).toBe(true);
  });

  it("ignore les tâches qui ne sont plus chez le client", () => {
    expect(needsChase(task({ status: "DONE" }), d("2026-12-01T00:00:00Z"))).toBe(false);
  });
});

describe("chaseState / chaseLabel", () => {
  const now = d("2026-10-08T10:00:00Z"); // jeudi
  it("signale un projet à relancer", () => {
    const state = chaseState([task()], null, now);
    expect(state).toMatchObject({ kind: "due", count: 1, oldestDays: 7 });
    expect(chaseLabel(state, now)).toBe("À relancer");
  });

  it("après une relance, le projet quitte « à relancer » pour 5 jours", () => {
    const tasks = [task({ lastChasedAt: d("2026-10-07T10:00:00Z") })];
    const state = chaseState(tasks, d("2026-10-07T10:00:00Z"), now);
    expect(state.kind).toBe("chased");
    expect(chaseLabel(state, now)).toBe(`Relancé il y a 1${N}j · prochaine relance lun.`);
    expect(chaseState(tasks, d("2026-10-07T10:00:00Z"), d("2026-10-12T10:00:00Z")).kind).toBe("due");
  });

  it("ne dit rien sans tâche chez le client", () => {
    expect(chaseLabel(chaseState([task({ status: "TODO" })], null, now), now)).toBeNull();
  });
});

describe("buildChaseMessage", () => {
  it("salue le contact, liste les éléments et signe", () => {
    const { subject, body } = buildChaseMessage({
      contactFirstName: "Luna",
      projectName: "Bières Georges",
      senderFirstName: "Odo",
      items: [
        { title: "Photos produits", zone: "Fiche produit", since: d("2026-10-03T10:00:00Z") },
        { title: "Textes", zone: null, since: d("2026-10-05T10:00:00Z"), waitingFor: "textes page À propos" },
      ],
    });
    expect(subject).toBe(`Bières Georges${N}: éléments en attente`);
    expect(body.split("\n")[0]).toBe("Bonjour Luna,");
    expect(body).toContain(`- Photos produits (Fiche produit)${N}: en attente depuis le 03/10`);
    expect(body).toContain(`- Textes${N}: textes page À propos, en attente depuis le 05/10`);
    expect(body.trim().endsWith("Odo · Suzali Conseil")).toBe(true);
  });

  it("dit simplement « Bonjour, » sans contact", () => {
    const { body } = buildChaseMessage({ projectName: "X", senderFirstName: "Odo", items: [] });
    expect(body.startsWith("Bonjour,\n")).toBe(true);
  });
});

describe("mailtoLink", () => {
  it("encode l’objet et le corps", () => {
    expect(mailtoLink("luna@ex.fr", "A : b", "c d")).toBe("mailto:luna@ex.fr?subject=A%20%3A%20b&body=c%20d");
  });
  it("renonce au-delà de la longueur fiable", () => {
    expect(mailtoLink(null, "x", "y".repeat(3000))).toBeNull();
  });
});
