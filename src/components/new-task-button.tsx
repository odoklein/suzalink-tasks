"use client";

import { SquarePen } from "lucide-react";

import { PrimaryButton } from "@/components/dialog";
import { useOpenNewTask } from "@/components/new-task-dialog";

export function NewTaskButton() {
  const openNewTask = useOpenNewTask();
  return (
    <PrimaryButton type="button" onClick={openNewTask} className="max-md:hidden">
      <SquarePen className="size-4" />
      Nouvelle tâche
      <kbd className="ml-1 rounded bg-bg/15 px-1.5 font-mono text-[10px] font-medium">C</kbd>
    </PrimaryButton>
  );
}
