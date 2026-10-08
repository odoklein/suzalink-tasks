import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { PinChangeGate } from "@/components/pin-change-gate";

const navigation = vi.hoisted(() => ({ pathname: "/", replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}));

afterEach(() => {
  cleanup();
  navigation.replace.mockClear();
});

describe("PinChangeGate (P1-14)", () => {
  it("masque la page et renvoie vers Paramètres tant que le code provisoire n'est pas changé", () => {
    navigation.pathname = "/";
    render(<PinChangeGate>contenu d’Aujourd’hui</PinChangeGate>);
    expect(screen.queryByText("contenu d’Aujourd’hui")).toBeNull();
    expect(navigation.replace).toHaveBeenCalledWith("/settings?premiere-connexion=1");
  });

  it("laisse passer la page Paramètres", () => {
    navigation.pathname = "/settings";
    render(<PinChangeGate>formulaire du code</PinChangeGate>);
    expect(screen.getByText("formulaire du code")).toBeTruthy();
    expect(navigation.replace).not.toHaveBeenCalled();
  });
});
