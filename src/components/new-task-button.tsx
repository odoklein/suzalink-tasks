"use client";

import { SquarePen } from "lucide-react";

import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";

export function NewTaskButton() {
  const { setNewTaskOpen } = useApp();
  return (
    <Button variant="primary" icon={<SquarePen className="size-4" />} onClick={() => setNewTaskOpen(true)} className="max-md:hidden">
      Nouvelle tâche
      <Kbd onInk className="ml-1">C</Kbd>
    </Button>
  );
}
