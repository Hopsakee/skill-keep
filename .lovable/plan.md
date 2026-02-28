## Skill Keep — Clean Database

This is a fresh application. There is NO migration from any legacy "prompt-vault" database. The SQLite database uses `skill-keep-db` as its IndexedDB name and all tables use the `skill_*` naming convention from the start.

### Database tables

| Table | Purpose |
|---|---|
| `skills` | Core skill records |
| `skill_versions` | Versioned content per skill |
| `tags` | Tag definitions with colors |
| `skill_tags` | Many-to-many skill↔tag |
| `version_annotations` | Notes per version |
| `chat_examples` | Example conversations per version |
| `skill_usage` | Usage explanations per skill |
| `settings` | Key-value app settings |
| `skill_files` | Attached files per skill |
