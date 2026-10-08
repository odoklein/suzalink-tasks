import "server-only";

/**
 * Point unique de branchement des intégrations sur la file de travaux :
 * chaque module importé ici appelle registerConsumer / registerDailyStep /
 * registerJobHandler au chargement.
 */
export {};
