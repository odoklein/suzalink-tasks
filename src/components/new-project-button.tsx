"use client";

import { Plus } from "lucide-react";

import { useApp } from "@/components/app-context";
import { PrimaryButton } from "@/components/dialog";

export function NewProjectButton() {
  const { setNewProjectOpen } = useApp();
  return (
    <PrimaryButton type="button" onClick={() => setNewProjectOpen(true)}>
      <Plus className="size-4" />
      Nouveau projet
    </PrimaryButton>
  );
}
