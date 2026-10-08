import { describe, expect, it } from "vitest";

import { clientIp } from "@/lib/request-ip";

describe("clientIp", () => {
  it("préfère l'en-tête de Netlify", () => {
    expect(clientIp(new Headers({ "x-nf-client-connection-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe("1.2.3.4");
  });
  it("prend la première adresse de x-forwarded-for", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
  });
  it("renvoie null sans en-tête", () => {
    expect(clientIp(new Headers())).toBeNull();
  });
});
