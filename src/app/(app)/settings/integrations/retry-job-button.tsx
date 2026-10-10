"use client";

import { RotateCw } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { retryFailedJob } from "@/app/actions/integrations";
import { GhostButton } from "@/components/dialog";

export function RetryJobButton({ jobId }: { jobId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <GhostButton
      type="button"
      size="sm"
      loading={pending}
      icon={<RotateCw className="size-3.5" />}
      onClick={() =>
        startTransition(async () => {
          const result = await retryFailedJob(jobId);
          if ("error" in result) toast.error(result.error);
          else toast.success("Travail relancé : il repartira au prochain passage du cron.");
        })
      }
    >
      Relancer
    </GhostButton>
  );
}
