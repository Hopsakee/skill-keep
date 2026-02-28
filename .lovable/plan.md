

# Skill Keep -- Full Rewrite Plan

## Root Cause Analysis

The app works in development but breaks in production due to a **race condition in the database singleton**. Here's what happens:

1. `DatabaseProvider` calls `initDatabase()` on mount
2. Before it completes, React Query hooks also call `getDatabase()` which calls `initDatabase()`
3. Both calls pass the `if (db) return db` guard (since `db` is still `null` while WASM loads)
4. Two separate `SQL.Database` instances are created -- the second overwrites the first
5. Tables created by the first call are lost; inserts go into an empty, un-initialized database
6. In development, hot-module-reload and faster WASM loading mask the timing window

This is a classic async singleton bug. The fix is to store the **initialization promise** rather than the result, so all callers await the same work.

## Plan Overview

### 1. Create architecture documentation (docs/ folder)

Create two Mermaid diagrams:

**docs/data-flow.md** -- How data moves through the system:
- User action -> React component -> mutation hook -> `getDatabase()` -> sql.js in-memory DB -> `saveDatabase()` -> IndexedDB persistence
- Page load -> IndexedDB -> sql.js -> React Query cache -> UI

**docs/app-flow.md** -- How the app boots and how components connect:
- `main.tsx` clears stale service workers
- `App.tsx` wraps everything in `DatabaseProvider` + `QueryClientProvider`
- `DatabaseProvider` gates rendering until DB is ready
- `Index.tsx` renders `SkillList` + `SkillEditor`
- All data access goes through hooks in `useLocalSkills.tsx`

### 2. Rewrite `src/lib/database.ts` -- Fix the race condition

Replace the module-level `let db` singleton pattern with a **promise-based singleton**:

```typescript
let dbPromise: Promise<Database> | null = null;

export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = initDatabaseInternal();
  }
  return dbPromise;
}
```

This guarantees that no matter how many callers invoke `getDatabase()` concurrently, only ONE initialization runs. All others await the same promise.

Additional cleanup:
- Remove the separate `initDatabase` export (merge into `getDatabase`)
- Simplify `clearDatabase` to also reset the promise
- Remove leftover `console.log` debug statements
- Keep `saveDatabase`, `generateId`, `exportDatabaseAsJson`, `importMarkdownSkills` as-is but have them use the new `getDatabase()`

### 3. Simplify `src/hooks/useDatabaseInit.tsx`

Update `DatabaseProvider` to use the new `getDatabase()` instead of calling `initDatabase()` directly. The provider still gates rendering until the DB is ready.

### 4. Polish `src/hooks/useLocalSkills.tsx`

- No logic changes needed (the hooks already call `getDatabase()` correctly)
- Add try/catch to each `mutationFn` around the db operations for better error reporting in production
- Ensure `saveDatabase()` is always awaited (it already is)

### 5. Clean up remaining files

- Remove stale `console.log` statements from `database.ts`
- No changes to components, types, constants, or utils -- they are clean

## Technical Details

### The singleton fix (core change):

```typescript
// BEFORE (buggy):
let db: Database | null = null;
export async function initDatabase(): Promise<Database> {
  if (db) return db;        // <-- race: two callers both see null
  const SQL = await initSqlJs(...);  // <-- slow async gap
  db = new SQL.Database();   // <-- second caller overwrites first
  createTables();
  return db;
}

// AFTER (safe):
let dbPromise: Promise<Database> | null = null;
export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = createDatabase();  // <-- only ONE promise ever created
  }
  return dbPromise;
}
```

### Files to create:
- `docs/data-flow.md`
- `docs/app-flow.md`

### Files to modify:
- `src/lib/database.ts` -- Race condition fix + cleanup
- `src/hooks/useDatabaseInit.tsx` -- Use new `getDatabase()`
- `src/hooks/useLocalSkills.tsx` -- Add error wrapping to mutations

### Files unchanged:
- All components (`SkillEditor`, `SkillList`, `Header`, etc.)
- All types, constants, utilities
- `App.tsx`, `main.tsx`, `vite.config.ts`

