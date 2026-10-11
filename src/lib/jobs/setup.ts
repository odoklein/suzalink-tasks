import "server-only";

import { registerDailyStep } from "@/lib/jobs/handlers";
import { registerEmailJobs } from "@/lib/emails/jobs";
import { purgeDoneJobs } from "@/lib/jobs/queue";
import { registerMeetingJobs } from "@/lib/meetings/jobs";
import { purgeRateLimits } from "@/lib/rate-limit";

/**
 * Point unique de branchement des intégrations sur la file de travaux :
 * consommateurs d'événements, étapes quotidiennes, types de travaux.
 */
registerDailyStep({ name: "purge-rate-limits", run: purgeRateLimits });
registerDailyStep({ name: "purge-done-jobs", run: () => purgeDoneJobs() });
registerMeetingJobs();
registerEmailJobs();
