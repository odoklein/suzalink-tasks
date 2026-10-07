"use client";

import { SquarePen } from "lucide-react";

import { useApp } from "@/components/app-context";
import { PrimaryButton } from "@/components/dialog";

export function NewTaskButton() {
  const { setNewTaskOpen } = useApp();
  return (
    <PrimaryButton type="button" onClick={() => setNewTaskOpen(true)}>
      <SquarePen className="size-4" />
      Nouvelle tâche
      <kbd className="ml-1 rounded bg-bg/15 px-1.5 font-mono text-[10px] font-medium">C</kbd>
    </PrimaryButton>
  );
}
