import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { axe } from "vitest-axe";
import { afterEach, describe, expect, it } from "vitest";

import { Badge } from "@/components/ui/badge";
import { Button, IconButton } from "@/components/ui/button";
import { Checkbox, Switch } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { SectionHeader } from "@/components/ui/section-header";
import { TabPanel, Tabs } from "@/components/ui/tabs";

afterEach(cleanup);

async function noViolations(container: HTMLElement) {
  const results = await axe(container);
  expect(results.violations.map((violation) => violation.id)).toEqual([]);
}

describe("Button", () => {
  it("garde le type button et se désactive pendant loading", () => {
    render(
      <Button loading icon={<span data-testid="icon" />}>
        Enregistrer
      </Button>,
    );
    const button = screen.getByRole("button", { name: /Enregistrer/ });
    expect(button).toHaveProperty("type", "button");
    expect(button).toHaveProperty("disabled", true);
    expect(button.getAttribute("aria-busy")).toBe("true");
    // L’icône est remplacée par le spinner, le libellé reste (largeur stable).
    expect(screen.queryByTestId("icon")).toBeNull();
  });

  it("IconButton expose son label comme nom accessible", () => {
    render(
      <IconButton label="Fermer">
        <svg aria-hidden="true" />
      </IconButton>,
    );
    expect(screen.getByRole("button", { name: "Fermer" })).toBeTruthy();
  });
});

describe("Input", () => {
  it("relie le message d’erreur au champ", () => {
    render(<Input aria-label="Titre" error="Ajoutez un titre" />);
    const input = screen.getByRole("textbox", { name: "Titre" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const message = screen.getByRole("alert");
    expect(input.getAttribute("aria-describedby")).toContain(message.id);
  });
});

describe("Checkbox et Switch", () => {
  it("se cochent au clic sur le libellé", async () => {
    const user = userEvent.setup();
    render(
      <>
        <Checkbox label="Masquer les tâches faites" />
        <Switch label="Raccourcis à une touche" defaultChecked />
      </>,
    );
    const box = screen.getByRole("checkbox", { name: "Masquer les tâches faites" }) as HTMLInputElement;
    await user.click(screen.getByText("Masquer les tâches faites"));
    expect(box.checked).toBe(true);
    expect((screen.getByRole("switch") as HTMLInputElement).checked).toBe(true);
  });
});

function Segments() {
  const [value, setValue] = useState<"zone" | "status">("zone");
  return (
    <SegmentedControl
      label="Regrouper par"
      value={value}
      onChange={setValue}
      options={[
        { value: "zone", label: "Par page" },
        { value: "status", label: "Par statut" },
      ]}
    />
  );
}

describe("SegmentedControl", () => {
  it("change de segment avec les flèches", async () => {
    const user = userEvent.setup();
    render(<Segments />);
    const first = screen.getByRole("radio", { name: "Par page" });
    first.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "Par statut" }).getAttribute("aria-checked")).toBe("true");
    expect(first.getAttribute("aria-checked")).toBe("false");
  });
});

function TabsDemo() {
  const [value, setValue] = useState<"board" | "list" | "history">("board");
  return (
    <>
      <Tabs
        label="Vues"
        idBase="t"
        value={value}
        onChange={setValue}
        tabs={[
          { value: "board", label: "Tableau", count: 24 },
          { value: "list", label: "Liste" },
          { value: "history", label: "Activité" },
        ]}
      />
      <TabPanel idBase="t" value="board" active={value === "board"}>
        Colonnes
      </TabPanel>
      <TabPanel idBase="t" value="list" active={value === "list"}>
        Lignes
      </TabPanel>
    </>
  );
}

describe("Tabs", () => {
  it("navigue aux flèches, Début et Fin avec un tabindex itinérant", async () => {
    const user = userEvent.setup();
    render(<TabsDemo />);
    const board = screen.getByRole("tab", { name: /Tableau/ });
    board.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Liste" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").textContent).toBe("Lignes");
    expect(board.getAttribute("tabindex")).toBe("-1");
    await user.keyboard("{End}");
    expect(screen.getByRole("tab", { name: "Activité" }).getAttribute("aria-selected")).toBe("true");
    await user.keyboard("{Home}");
    expect(board.getAttribute("aria-selected")).toBe("true");
  });
});

describe("accessibilité (axe)", () => {
  it("n’a aucune violation sur les primitives de base", async () => {
    const { container } = render(
      <main>
        <SectionHeader title="Chez le client" count={3} />
        <Badge tone="waiting">En attente</Badge>
        <Button variant="primary">Nouvelle tâche</Button>
        <Input aria-label="Titre" hint="180 caractères au maximum" />
        <Checkbox label="Hors périmètre (€)" />
        <EmptyState title="Aucune tâche">Ajoutez-en une.</EmptyState>
      </main>,
    );
    await noViolations(container);
  });
});
