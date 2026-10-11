"use client";

import { RefreshCw } from "lucide-react";

import { refreshMyCalendar } from "@/app/actions/meetings";
import { useMeetingAction } from "@/components/meetings/use-meeting-action";
import { Button } from "@/components/ui/button";

/** Relit tout de suite l'agenda Google du membre (sans attendre le cron). */
export function RefreshCalendarButton() {
  const { pending, run } = useMeetingAction();
  return (
    <Button size="sm" variant="ghost" icon={<RefreshCw className="size-3.5" />} loading={pending} onClick={() => run(() => refreshMyCalendar(), "Agenda relu")}>
      Actualiser
    </Button>
  );
}
