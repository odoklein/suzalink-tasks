import { describe, expect, it } from "vitest";

import { toMeetingDraft } from "@/lib/meetings/drafts";
import { suggestProject } from "@/lib/meetings/matching";

// Agence : le domaine, plus un membre qui utilise une adresse @gmail.com.
const agency = { domain: "suzaliconseil.com", memberEmails: new Set(["odosuzali@gmail.com"]) };

const event = {
  id: "evt_20261012T090000Z",
  summary: "Point refonte BG",
  start: { dateTime: "2026-10-12T11:00:00+02:00" },
  end: { dateTime: "2026-10-12T11:45:00+02:00" },
  attendees: [
    { email: "Odo@suzaliconseil.com", self: true, responseStatus: "accepted" },
    { email: "luna@33degres.fr", displayName: "Luna Cervi", organizer: true },
    { email: "salle-2@resource.calendar.google.com", resource: true },
  ],
  hangoutLink: "https://meet.google.com/abc-defg-hij",
};

describe("toMeetingDraft", () => {
  it("garde les invités (sans les salles), l'heure et le lien", () => {
    const result = toMeetingDraft(event, agency);
    expect(result.kind).toBe("meeting");
    if (result.kind !== "meeting") return;
    expect(result.draft.attendees.map((attendee) => attendee.email)).toEqual(["odo@suzaliconseil.com", "luna@33degres.fr"]);
    expect(result.draft.startsAt.toISOString()).toBe("2026-10-12T09:00:00.000Z");
    expect(result.draft.internalOnly).toBe(false);
    expect(result.draft.link?.nativeMeetingId).toBe("abc-defg-hij");
  });

  it("repère une réunion interne, membres en @gmail.com compris", () => {
    const result = toMeetingDraft({ ...event, attendees: [{ email: "hichem@suzaliconseil.com" }, { email: "OdoSuzali@gmail.com" }] }, agency);
    expect(result.kind === "meeting" && result.draft.internalOnly).toBe(true);
    // Un client en @gmail.com reste un invité extérieur.
    const withClient = toMeetingDraft({ ...event, attendees: [{ email: "odosuzali@gmail.com", self: true }, { email: "client@gmail.com" }] }, agency);
    expect(withClient.kind === "meeting" && withClient.draft.internalOnly).toBe(false);
  });

  it("ignore les journées entières et les absences, signale les annulations et les refus", () => {
    expect(toMeetingDraft({ id: "a", start: { date: "2026-10-12" }, end: { date: "2026-10-13" } }, agency).kind).toBe("ignored");
    expect(toMeetingDraft({ ...event, eventType: "outOfOffice" }, agency).kind).toBe("ignored");
    expect(toMeetingDraft({ id: "b", status: "cancelled" }, agency)).toEqual({ kind: "cancelled", calendarEventId: "b" });
    const declined = { ...event, attendees: [{ email: "odo@suzaliconseil.com", self: true, responseStatus: "declined" }] };
    expect(toMeetingDraft(declined, agency).kind).toBe("cancelled");
  });
});

describe("suggestProject", () => {
  const projects = [
    { id: "p1", key: "BG", name: "Bonne Graine", clientId: "c1" },
    { id: "p2", key: "EPH", name: "Ephoto", clientId: "c1" },
    { id: "p3", key: "CLZ", name: "Clauzel", clientId: "c2" },
  ];
  const contacts = [
    { email: "luna@33degres.fr", clientId: "c1" },
    { email: "marie@clauzel.fr", clientId: "c2" },
    { email: "perso@gmail.com", clientId: "c2" },
  ];

  it("trouve le projet par un contact connu, le titre départage", () => {
    expect(suggestProject({ title: "Point BG", attendeeEmails: ["luna@33degres.fr"] }, contacts, projects, agency)).toEqual({
      projectId: "p1",
      by: "titre",
    });
    expect(suggestProject({ title: "Point hebdo", attendeeEmails: ["luna@33degres.fr"] }, contacts, projects, agency)).toBeNull();
    expect(suggestProject({ title: "Point hebdo", attendeeEmails: ["marie@clauzel.fr"] }, contacts, projects, agency)).toEqual({
      projectId: "p3",
      by: "contact",
    });
  });

  it("un membre en @gmail.com n'est jamais pris pour un client", () => {
    const withMember = [...contacts, { email: "odosuzali@gmail.com", clientId: "c2" }];
    expect(suggestProject({ title: "Visio", attendeeEmails: ["odosuzali@gmail.com"] }, withMember, projects, agency)).toBeNull();
  });

  it("reconnaît le domaine d'un client, jamais une messagerie grand public", () => {
    expect(suggestProject({ title: "Visio", attendeeEmails: ["paul@clauzel.fr"] }, contacts, projects, agency)?.projectId).toBe("p3");
    expect(suggestProject({ title: "Visio", attendeeEmails: ["inconnu@gmail.com"] }, contacts, projects, agency)).toBeNull();
  });

  it("sans contact connu, cherche la clé ou le nom dans le titre", () => {
    expect(suggestProject({ title: "Ephoto : maquettes", attendeeEmails: ["x@autre.fr"] }, contacts, projects, agency)?.projectId).toBe(
      "p2",
    );
    expect(suggestProject({ title: "Café", attendeeEmails: [] }, contacts, projects, agency)).toBeNull();
  });
});
