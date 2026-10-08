"use client";

import { Plus } from "lucide-react";

import { useApp } from "@/components/app-context";
import { Button } from "@/components/ui/button";

export function NewProjectButton() {
  const { setNewProjectOpen } = useApp();
  return (
    <Button variant="primary" icon={<Plus className="size-4" />} onClick={() => setNewProjectOpen(true)}>
      Nouveau projet
    </Button>
  );
}
