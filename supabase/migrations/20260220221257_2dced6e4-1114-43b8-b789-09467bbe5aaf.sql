-- Add description and license columns to prompts table (local SQLite migration handled in migrateDatabase)
-- This migration is a no-op for the cloud DB since skills are stored locally in SQLite
-- The actual SQLite migration is handled in src/lib/database.ts migrateDatabase()
SELECT 1;