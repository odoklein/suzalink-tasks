import "server-only";

import { registerDailyStep } from "@/lib/jobs/handlers";
import { purgeRateLimits } from "@/lib/rate-limit";

/**
 * Point unique de branchement des intégrations sur la file de travaux :
 * consommateurs d'événements, étapes quotidiennes, types de travaux.
 */
registerDailyStep({ name: "purge-rate-limits", run: purgeRateLimits });
