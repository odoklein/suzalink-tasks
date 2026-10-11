import { describe, expect, it } from "vitest";

import { findMeetingLink, parseMeetingUrl, urlsIn } from "@/lib/meetings/links";

describe("parseMeetingUrl", () => {
  it("reconnaît Google Meet et retire les paramètres", () => {
    expect(parseMeetingUrl("https://meet.google.com/ABC-defg-hij?authuser=1&hs=122")).toEqual({
      platform: "GOOGLE_MEET",
      url: "https://meet.google.com/abc-defg-hij",
      nativeMeetingId: "abc-defg-hij",
      passcode: null,
    });
    expect(parseMeetingUrl("https://meet.google.com/abc-defg-hijk")).toBeNull();
    expect(parseMeetingUrl("https://meet.google.com/landing")).toBeNull();
  });

  it("reconnaît Teams, avec son code", () => {
    expect(parseMeetingUrl("https://teams.live.com/meet/9876543210123?p=AbCdEf")).toEqual({
      platform: "TEAMS",
      url: "https://teams.live.com/meet/9876543210123",
      nativeMeetingId: "9876543210123",
      passcode: "AbCdEf",
    });
    expect(parseMeetingUrl("https://teams.microsoft.com/meet/31234567890?p=xyz")?.nativeMeetingId).toBe("31234567890");
    const join = "https://teams.microsoft.com/l/meetup-join/19%3ameeting_YmY%40thread.v2/0?context=%7b%22Tid%22%3a%22t%22%7d";
    expect(parseMeetingUrl(join)).toMatchObject({ platform: "TEAMS", nativeMeetingId: "19:meeting_YmY@thread.v2", url: join });
    expect(parseMeetingUrl("https://teams.microsoft.com/l/meetup-join/autre-chose/0")).toBeNull();
  });

  it("reconnaît Zoom, sous-domaine et code compris", () => {
    expect(parseMeetingUrl("https://us02web.zoom.us/j/85012345678?pwd=Q2xpZW50&uname=x")).toEqual({
      platform: "ZOOM",
      url: "https://us02web.zoom.us/j/85012345678",
      nativeMeetingId: "85012345678",
      passcode: "Q2xpZW50",
    });
    expect(parseMeetingUrl("https://zoom.us/my/salle-perso")).toBeNull();
  });

  it("ignore ce qui n'est pas un lien de réunion", () => {
    expect(parseMeetingUrl("https://www.suzaliconseil.com/contact")).toBeNull();
    expect(parseMeetingUrl("pas un lien")).toBeNull();
  });
});

describe("urlsIn", () => {
  it("extrait les liens d'une description HTML", () => {
    expect(
      urlsIn('Rejoindre : <a href="https://zoom.us/j/85012345678?pwd=a&amp;b=1">ici</a>. Doc : https://exemple.fr/doc.'),
    ).toEqual(["https://zoom.us/j/85012345678?pwd=a&b=1", "https://exemple.fr/doc"]);
    expect(urlsIn(undefined)).toEqual([]);
  });
});

describe("findMeetingLink", () => {
  it("préfère la visioconférence attachée", () => {
    const link = findMeetingLink({
      conferenceData: { entryPoints: [{ entryPointType: "phone", uri: "tel:+33" }, { entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }] },
      description: "https://zoom.us/j/85012345678",
    });
    expect(link?.platform).toBe("GOOGLE_MEET");
  });

  it("cherche ensuite dans le lieu puis la description", () => {
    expect(findMeetingLink({ location: "Salle 2 / https://teams.live.com/meet/9876543210123?p=k" })?.passcode).toBe("k");
    expect(findMeetingLink({ description: "Ordre du jour… https://us06web.zoom.us/j/85012345678" })?.platform).toBe("ZOOM");
    expect(findMeetingLink({ location: "Bureau", description: "Pas de lien" })).toBeNull();
  });

  it("reprend le code fourni à part par la visioconférence", () => {
    const link = findMeetingLink({
      conferenceData: { entryPoints: [{ entryPointType: "video", uri: "https://zoom.us/j/85012345678", passcode: "123456" }] },
    });
    expect(link?.passcode).toBe("123456");
  });
});
