"use client";

import { SquarePen } from "lucide-react";

import { useOpenNewTask } from "@/components/new-task-dialog";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

export function NewTaskButton() {
  const openNewTask = useOpenNewTask();
  return (
    <Button variant="primary" icon={<SquarePen className="size-4" />} onClick={openNewTask} className="max-md:hidden">
      Nouvelle tâche
      <Kbd onInk className="ml-1">C</Kbd>
    </Button>
  );
}
