

## Full Rename: "Prompt" to "Skill" -- Including Database Tables

Every occurrence of "prompt" in the codebase will be renamed to "skill", including the SQLite table names. A migration step will rename existing tables so no data is lost.

---

### 1. Database tables rename (`src/lib/database.ts`)

Rename all SQLite tables:

| Old table | New table |
|---|---|
| `prompts` | `skills` |
| `prompt_versions` | `skill_versions` |
| `prompt_tags` | `skill_tags` |
| `prompt_usage` | `skill_usage` |

The `createTables()` function will use the new names. A new migration step in `migrateDatabase()` will detect old table names and run `ALTER TABLE ... RENAME TO ...` for each one, preserving existing user data.

All SQL queries throughout the codebase will reference the new table names.

### 2. Type definitions (`src/types/index.ts`)

- `Prompt` -> `Skill`
- `PromptVersion` -> `SkillVersion` (field `prompt_id` -> `skill_id`)
- `PromptUsageData` -> `SkillUsageData` (field `prompt_id` -> `skill_id`)
- `PromptExportData` -> `SkillExportData`
- `SkillFile.prompt_id` -> `SkillFile.skill_id`

### 3. Constants (`src/constants/index.ts`)

- `PROMPTS_FOLDER` -> `SKILLS_FOLDER` (value changes to `'skills'`)
- `DB_NAME` stays `'prompt-vault-db'` only because IndexedDB key changes would lose existing data silently -- but we can rename this too if you prefer a clean slate

### 4. Hooks

- `src/hooks/useLocalPrompts.tsx` -> `src/hooks/useLocalSkills.tsx`
- All exported hooks: `usePrompts` -> `useSkills`, `usePromptVersions` -> `useSkillVersions`, `usePromptUsage` -> `useSkillUsage`
- All internal variables: `promptId` -> `skillId`, `createPrompt` -> `createSkill`, etc.
- Query keys: `['prompts']` -> `['skills']`, etc.

- `src/hooks/useKeyboardShortcuts.tsx`: `onNewPrompt` -> `onNewSkill`, `onCopyActivePrompt` -> `onCopyActiveSkill`

### 5. Components -- file renames

| Current file | New file |
|---|---|
| `PromptList.tsx` | `SkillList.tsx` |
| `PromptEditor.tsx` | `SkillEditor.tsx` |
| `PromptUsage.tsx` | `SkillUsage.tsx` |

All component names, prop types, and internal variables renamed accordingly.

### 6. UI strings

All user-facing text updated from "prompt" to "skill" (e.g., "New skill", "Copy active skill", shortcut descriptions, import/export labels, conflict dialogs).

### 7. Page component (`src/pages/Index.tsx`)

- `selectedPrompt` -> `selectedSkill`, `isNewPrompt` -> `isNewSkill`, handler and ref renames, updated imports.

### 8. Utility files

- `src/utils/skillExport.ts`: internal variable renames, SQL queries updated to new table names
- `src/utils/skillImport.ts`: `promptId` -> `skillId`, SQL queries updated
- `src/utils/markdown.ts`: type import renames
- `src/lib/database.ts`: `MarkdownPrompt` -> `MarkdownSkill`, `importMarkdownPrompts` -> `importMarkdownSkills`, all SQL updated

### 9. GitHub sync (`src/hooks/useLocalGitHubSync.tsx`)

- `PromptFullData` -> `SkillFullData`, `PromptSimpleData` -> `SkillSimpleData`
- Internal variables and SQL queries updated

### 10. README.md and CONTRIBUTING.md

Updated to reflect "agent skills" terminology throughout.

### 11. Migration strategy for existing users

In `migrateDatabase()`, before any other migration, check if the old tables exist and rename them:

```sql
ALTER TABLE prompts RENAME TO skills;
ALTER TABLE prompt_versions RENAME TO skill_versions;
ALTER TABLE prompt_tags RENAME TO skill_tags;
ALTER TABLE prompt_usage RENAME TO skill_usage;
```

Column names like `prompt_id` inside the tables will also be addressed. SQLite does not support `ALTER TABLE ... RENAME COLUMN` in all versions, so the migration will recreate tables with the new column names and copy data over where needed.

