import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SelectMenu } from "@/components/select-menu";

const options = [
  { value: "TODO", label: "À faire" },
  { value: "DONE", label: "Terminé" },
];

/** happy-dom ne fait pas de mise en page : on impose la géométrie du déclencheur et du menu. */
function mockGeometry({ triggerTop, triggerBottom, menuHeight }: { triggerTop: number; triggerBottom: number; menuHeight: number }) {
  vi.spyOn(HTMLButtonElement.prototype, "getBoundingClientRect").mockReturnValue({
    top: triggerTop,
    bottom: triggerBottom,
    left: 100,
    right: 140,
    width: 40,
    height: triggerBottom - triggerTop,
    x: 100,
    y: triggerTop,
    toJSON: () => ({}),
  });
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(menuHeight);
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(menuHeight);
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(224);
}

function renderMenu(onChange = vi.fn()) {
  render(
    <div data-testid="clip" style={{ overflow: "hidden" }}>
      <SelectMenu label="Changer le statut" value="TODO" options={options} onChange={onChange} trigger={<span>statut</span>} />
    </div>,
  );
  return onChange;
}

beforeEach(() => {
  window.innerHeight = 600;
  window.innerWidth = 1000;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SelectMenu : portail (P1-07)", () => {
  it("rend la liste dans document.body, hors du conteneur qui rogne", async () => {
    mockGeometry({ triggerTop: 100, triggerBottom: 124, menuHeight: 120 });
    renderMenu();
    await userEvent.click(screen.getByLabelText("Changer le statut"));

    const list = await screen.findByRole("listbox");
    expect(screen.getByTestId("clip").contains(list)).toBe(false);
    expect(document.body.contains(list)).toBe(true);
    const menu = list.closest("[data-select-menu]") as HTMLElement;
    expect(menu.className.split(" ")).toContain("fixed"); // position: fixed (pas de CSS chargé dans ce test)
  });

  it("s'ouvre sous le déclencheur quand il y a de la place", async () => {
    mockGeometry({ triggerTop: 100, triggerBottom: 124, menuHeight: 120 });
    renderMenu();
    await userEvent.click(screen.getByLabelText("Changer le statut"));

    const menu = (await screen.findByRole("listbox")).closest("[data-select-menu]") as HTMLElement;
    expect(menu.style.top).toBe("128px"); // bas du déclencheur + 4 px
    expect(menu.style.bottom).toBe("");
  });

  it("se retourne au-dessus du déclencheur quand il manque de la place en bas (dernière ligne)", async () => {
    mockGeometry({ triggerTop: 570, triggerBottom: 594, menuHeight: 150 });
    renderMenu();
    await userEvent.click(screen.getByLabelText("Changer le statut"));

    const menu = (await screen.findByRole("listbox")).closest("[data-select-menu]") as HTMLElement;
    expect(menu.style.top).toBe("");
    expect(menu.style.bottom).toBe("34px"); // 600 - 570 + 4
  });

  it("se ferme sur un pointerdown à l'extérieur, mais pas à l'intérieur du menu", async () => {
    mockGeometry({ triggerTop: 100, triggerBottom: 124, menuHeight: 120 });
    renderMenu();
    await userEvent.click(screen.getByLabelText("Changer le statut"));
    const list = await screen.findByRole("listbox");

    fireEvent.pointerDown(list);
    expect(screen.queryByRole("listbox")).not.toBeNull();

    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("choisit une option au clic et se ferme", async () => {
    mockGeometry({ triggerTop: 100, triggerBottom: 124, menuHeight: 120 });
    const onChange = renderMenu();
    await userEvent.click(screen.getByLabelText("Changer le statut"));
    await userEvent.click(await screen.findByText("Terminé"));

    expect(onChange).toHaveBeenCalledWith("DONE");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("se ferme avec Échap", async () => {
    mockGeometry({ triggerTop: 100, triggerBottom: 124, menuHeight: 120 });
    renderMenu();
    await userEvent.click(screen.getByLabelText("Changer le statut"));
    await screen.findByRole("listbox");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});
