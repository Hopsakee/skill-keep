
# Adding Bundled Files Support to Agent Skills

## What We're Adding

Agent skills can include two types of bundled files alongside the main `SKILL.md`:

- **Script files** — executable scripts (`.py`, `.js`, `.sh`, `.ts`, etc.) that the skill's instructions reference for automation tasks
- **Reference files** — additional `.md` files containing detailed documentation, lookup tables, examples, or domain knowledge that the instructions can point to

These are "Level 3" resources: loaded on-demand when triggered by the skill's instructions.

---

## New Database Table: `skill_files`

A new table stores all bundled files per skill (not per version — files are shared across versions, but can be updated independently):

```text
skill_files
-----------
id          TEXT PRIMARY KEY
prompt_id   TEXT (FK → prompts.id, ON DELETE CASCADE)
filename    TEXT NOT NULL        -- e.g. "analyze.py", "reference-data.md"
file_type   TEXT NOT NULL        -- 'script' | 'reference'
content     TEXT NOT NULL        -- full text content of the file
created_at  TEXT NOT NULL
updated_at  TEXT NOT NULL
UNIQUE(prompt_id, filename)
```

Files are attached at the **skill level** (not version level) because:
- Scripts and reference docs typically evolve independently from the SKILL.md instructions
- It mirrors how the real Claude skill filesystem works — bundled files sit in the same directory as SKILL.md
- This avoids copying large file blobs into every version snapshot

---

## Migration Strategy

The `migrateDatabase()` function in `src/lib/database.ts` already has a pattern for safe migrations. We add:

```sql
CREATE TABLE IF NOT EXISTS skill_files (
  id TEXT PRIMARY KEY,
  prompt_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_type TEXT CHECK(file_type IN ('script', 'reference')) NOT NULL DEFAULT 'reference',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE CASCADE,
  UNIQUE(prompt_id, filename)
)
```

This is added to both `createTables()` (for new databases) and `migrateDatabase()` (for existing databases with a table existence check).

---

## Type System Changes

In `src/types/index.ts`, add a new type:

```typescript
export interface SkillFile {
  id: string;
  prompt_id: string;
  filename: string;
  file_type: 'script' | 'reference';
  content: string;
  created_at: string;
  updated_at: string;
}
```

And extend `PromptExportData` / the GitHub sync `PromptFullData` interface to include `skill_files`.

---

## Hook: `useSkillFiles`

New hook in `src/hooks/useLocalPrompts.tsx` (or a new `useSkillFiles.tsx`):

```typescript
export function useSkillFiles(promptId: string | undefined) {
  // useQuery: SELECT all files for this prompt
  // useMutation: upsertSkillFile({ promptId, filename, file_type, content })
  // useMutation: deleteSkillFile(fileId)
  return { files, upsertFile, deleteFile, isLoading }
}
```

Operations:
- **List**: `SELECT * FROM skill_files WHERE prompt_id = ? ORDER BY file_type, filename`
- **Upsert**: `INSERT OR REPLACE INTO skill_files ...` (keyed on `prompt_id + filename`)
- **Delete**: `DELETE FROM skill_files WHERE id = ?`
- **Rename**: Update `filename` field (with uniqueness check)

---

## UI: New "Files" Tab in PromptEditor

A fifth tab is added to the editor in `src/components/PromptEditor.tsx`:

```text
[Skill content] [Deployment notes] [Test examples] [Version notes] [Bundled files]
```

The **Bundled Files** tab contains:

1. **Files list** — shows all attached files grouped by type:
   - Scripts section (icon: `<Terminal>` or `<Code>`)
   - Reference files section (icon: `<FileText>`)
   - Each row: filename chip + file type badge + Edit button + Delete button

2. **Add file dialog/inline form**:
   - Filename input (with validation: no spaces, valid chars, non-empty, no duplicates)
   - Type selector: Script / Reference file
   - Content textarea (monaco-like, monospace font)
   - Save button

3. **Edit inline**: clicking a file expands an editor inline showing the file content, editable, with a Save and Cancel button

4. **Character count** shown for each file's content

This is a new component: `src/components/SkillFiles.tsx`

---

## GitHub Sync Changes (`useLocalGitHubSync.tsx`)

### Data Structures

Extend `PromptFullData` to include:
```typescript
skill_files: Array<{
  filename: string;
  file_type: 'script' | 'reference';
  content: string;
}>
```

### `getLocalPromptsFullData()`

Add a query to fetch all skill files and attach them to the matching prompt in the map.

### `pushToGitHub()` — New File Layout

The GitHub repository structure becomes:

```text
skills-latest/
  my-skill-name/
    SKILL.md           ← active version body + YAML frontmatter (name, description)
    analyze.py         ← script file (pushed as-is)
    reference-data.md  ← reference file (pushed as-is)

skills-data/
  my-skill-name.json   ← full JSON with all versions + metadata + files
```

Previously the sync pushed flat files (`skills-latest/my-skill-name.md`). Now it pushes a **directory per skill** containing `SKILL.md` plus all bundled files. This maps exactly to how the real Claude skill filesystem expects things laid out.

Implementation: instead of one blob per prompt, we create multiple blobs — one per file in the skill directory — and include them all in the git tree operation. The existing batch blob creation pattern (`prompts.flatMap(...)`) is extended to also iterate over `skill_files`.

### `getRemotePrompts()` — Reading Back

When pulling from GitHub, the `skills-data/*.json` files already contain the full `skill_files` array, so import is straightforward. On first pull from a repo that has the new directory structure, the JSON files provide the canonical source of truth.

### `addPromptToLocal()` / `updatePromptFromRemote()`

Both functions are extended to insert/update rows in `skill_files` when syncing from remote.

### Import (ZIP / JSON)

`exportDatabaseAsJson()` adds `skill_files` to the export. The import logic in `SettingsDialog` or `database.ts` is extended to read and insert `skill_files` rows.

---

## Files to Create/Modify

| File | Change |
|---|---|
| `src/types/index.ts` | Add `SkillFile` type; extend export types |
| `src/lib/database.ts` | Add `skill_files` table to `createTables()` + `migrateDatabase()`; add `skill_files` to `exportDatabaseAsJson()` |
| `src/hooks/useLocalPrompts.tsx` | Add `useSkillFiles()` hook with list/upsert/delete mutations |
| `src/components/SkillFiles.tsx` | New component — file manager UI (list, add, edit, delete) |
| `src/components/PromptEditor.tsx` | Add "Bundled files" tab wired to `SkillFiles` component |
| `src/hooks/useLocalGitHubSync.tsx` | Extend `PromptFullData`, `getLocalPromptsFullData()`, `pushToGitHub()`, `addPromptToLocal()`, `updatePromptFromRemote()` |

---

## Implementation Order

1. Add `SkillFile` type to `src/types/index.ts`
2. Add `skill_files` table to `src/lib/database.ts` (`createTables` + `migrateDatabase`)
3. Add `useSkillFiles` hook to `src/hooks/useLocalPrompts.tsx`
4. Create `src/components/SkillFiles.tsx` — file manager UI
5. Add "Bundled files" tab to `src/components/PromptEditor.tsx`
6. Update `src/hooks/useLocalGitHubSync.tsx` — extend all sync functions to handle `skill_files`

No existing data is lost — the migration is purely additive.
