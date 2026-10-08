-- P3-02 : recherche de tâches triée par similarité (palette Ctrl K).
-- Étape MANUELLE, à exécuter une fois sur Supabase (éditeur SQL) par un humain.
-- Sans elle, la recherche fonctionne quand même (ILIKE + classement simple).
-- Idempotent.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "Task_title_trgm_idx" ON "Task" USING GIN (title gin_trgm_ops);
