# Skill Keep — Project Requirements Document

## 1. Product Overview

**Skill Keep** is a local-first Progressive Web App (PWA) for managing AI agent skills. It runs entirely in the browser using an **in-browser SQLite database** (sql.js) persisted to IndexedDB. There is no server-side database — the user's browser IS the database.

The app allows users to create, version, organize, import, export, and sync "skills" — structured markdown documents (SKILL.md) that define capabilities for AI agents. Each skill can bundle additional files (scripts, reference documents) and metadata.

### Target Users
- AI practitioners who build and maintain libraries of agent skills/prompts
- Teams who want to version-control their skill definitions
- Users who want offline-first access to their skill library

### Core Value Proposition
- **100% local**: No account required, no server dependency, works offline
- **Installable PWA**: Works like a native app on desktop and mobile
- **GitHub sync**: Bidirectional synchronization with a GitHub repository
- **Version control**: Every edit creates a new version with full history
- **Bundled files**: Skills can include scripts, reference files, and other resources

---

## 2. Technology Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Framework | React 18 + TypeScript | Single-page application |
| Build tool | Vite | Fast HMR in development |
| Styling | Tailwind CSS + shadcn/ui | Design system with semantic tokens |
| State management | TanStack React Query | Cache layer over SQLite |
| Database | **sql.js (SQLite compiled to WASM)** | In-memory SQLite, persisted to IndexedDB |
| Persistence | IndexedDB (via `idb` library) | Durable storage for the SQLite binary |
| Routing | React Router v6 | Single route app (/) |
| Icons | Lucide React | Consistent icon set |
| PWA | Service Worker + Web App Manifest | Installable, works offline |
| Edge Functions | Supabase Edge Functions | Only for GitHub import proxy |

### Critical Architecture Decision: SQLite as Backend

The entire data layer MUST use **sql.js** (SQLite compiled to WebAssembly) running in the browser. This is non-negotiable.

- The WASM binary is loaded from CDN: `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm`
- The database lives in memory during the session
- After every write operation, the entire database is exported as a `Uint8Array` and saved to IndexedDB
- On page load, the saved bytes are loaded from IndexedDB and used to reconstruct the database
- A **promise-based singleton pattern** MUST be used to prevent race conditions during initialization

```
┌─────────────────────────────────────────────────┐
│                   Browser                        │
│                                                  │
│  React App ──▶ React Query ──▶ sql.js (WASM)    │
│                                    │             │
│                                    ▼             │
│                              IndexedDB           │
│                         (Uint8Array backup)       │
└─────────────────────────────────────────────────┘
```

### Progressive Web App (PWA) Requirements

The app MUST be installable as a PWA:
- Web App Manifest with name, icons (192x192, 512x512), theme color, background color
- Service Worker for offline caching of app shell and WASM binary
- `display: "standalone"` for native-like experience
- **Important**: The service worker strategy must handle cache invalidation properly to prevent stale code from persisting across deployments. Consider using `skipWaiting` + `clientsClaim` or a network-first strategy for the app shell.

---

## 3. Data Model

### 3.1 Database Schema

The SQLite database uses schema versioning (currently version `6`). On load, if the schema version doesn't match, the database is wiped and recreated fresh.

#### `skills` — Core skill records
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| title | TEXT | `''` | Skill name |
| description | TEXT | `''` | Short description |
| license | TEXT | `''` | License identifier |
| created_at | TEXT | `datetime('now')` | ISO timestamp |
| updated_at | TEXT | `datetime('now')` | ISO timestamp |

#### `skill_versions` — Version history for skill content
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| skill_id | TEXT | `''` | FK → skills.id (CASCADE) |
| content | TEXT | `''` | Markdown body of the skill |
| version_number | INTEGER | `1` | Sequential version number |
| is_active | INTEGER | `1` | Boolean: which version is current |
| created_at | TEXT | `datetime('now')` | ISO timestamp |

#### `tags` — Organizational tags
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| name | TEXT | NOT NULL, UNIQUE | Tag name |
| color | TEXT | `'#6366f1'` | Hex color |
| created_at | TEXT | `datetime('now')` | ISO timestamp |

#### `skill_tags` — Many-to-many junction table
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| skill_id | TEXT | FK → skills.id (CASCADE) |
| tag_id | TEXT | FK → tags.id (CASCADE) |
| | | UNIQUE(skill_id, tag_id) |

#### `version_annotations` — Notes per version
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| version_id | TEXT | FK → skill_versions.id (CASCADE), UNIQUE |
| note | TEXT | Freeform note |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

#### `chat_examples` — Example conversations per version
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| version_id | TEXT | FK → skill_versions.id (CASCADE), UNIQUE |
| messages | TEXT | JSON array of chat messages |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

#### `skill_usage` — Deployment/usage notes per skill
| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | PRIMARY KEY |
| skill_id | TEXT | FK → skills.id (CASCADE), UNIQUE |
| explanation | TEXT | Markdown text explaining how to use the skill |
| created_at | TEXT | ISO timestamp |
| updated_at | TEXT | ISO timestamp |

#### `skill_files` — Bundled files (scripts + references)
| Column | Type | Default | Description |
|--------|------|---------|-------------|
| id | TEXT | PRIMARY KEY | UUID |
| skill_id | TEXT | NOT NULL | FK → skills.id (CASCADE) |
| filename | TEXT | NOT NULL | File path (e.g., `scripts/analyze.py`) |
| file_type | TEXT | `'reference'` | Either `'script'` or `'reference'` |
| content | TEXT | `''` | File content as text |
| created_at | TEXT | | ISO timestamp |
| updated_at | TEXT | | ISO timestamp |
| | | | UNIQUE(skill_id, filename) |

#### `settings` — Key-value store for app settings
| Column | Type | Description |
|--------|------|-------------|
| key | TEXT | PRIMARY KEY |
| value | TEXT | Setting value |

Used for storing `schema_version` (currently `'6'`).

### 3.2 The SKILL.md Format

Each skill's primary content is a markdown file called `SKILL.md` with YAML frontmatter:

```markdown
---
name: "My Skill"
description: "What this skill does"
license: "MIT"
updated: 2025-01-15T12:00:00.000Z
---

The markdown body of the skill goes here.
This is the actual skill/prompt content.
```

### 3.3 Skill File Bundle Structure

When exported or synced, each skill becomes a directory:

```
my-skill/
├── SKILL.md           # Main skill content with frontmatter
├── scripts/
│   └── analyze.py     # Script files (type: 'script')
├── config.yaml        # Reference files (type: 'reference')
└── examples.json      # Reference files
```

File type inference rules:
- Files inside a `scripts/` folder → `script`
- Files with code extensions (`.py`, `.js`, `.ts`, `.sh`, `.rb`, `.go`, etc.) → `script`
- Everything else → `reference`

---

## 4. Features

### 4.1 Skill Management (CRUD)

#### Create Skill
- User clicks "New Skill" button
- Enters: title (required), description, license, content (markdown)
- Can optionally assign tags
- Creates a skill record + version 1

#### Read / Browse Skills
- Left sidebar shows all skills sorted by last updated (default) or alphabetically
- Search bar filters skills by title
- Tag filter: click tags to filter skills
- Each skill shows: title, tag badges, preview of content

#### Update Skill
- Editing content creates a **new version** (never overwrites)
- Title, description, license can be updated
- Tags can be added/removed
- The editor has a markdown preview toggle (side-by-side or raw)

#### Delete Skill
- Confirmation dialog required
- Cascades: deletes all versions, annotations, chat examples, usage notes, files, tag links

### 4.2 Version History

- Every content save creates a new version with an incremented version_number
- Only one version is `is_active = 1` at a time
- Users can browse all versions in a dropdown/list
- **Restore version**: Sets a previous version as active (deactivates current)
- Version annotations: Each version can have a note (e.g., "Added error handling")
- Chat examples carry over: When a new version is created, user prompts from the previous version's chat examples are copied (with empty assistant responses)

### 4.3 Skill Editor Tabs

The editor has 5 tabs:

1. **Editor** — Main markdown editor + metadata fields (title, description, license, tags)
   - Raw text editor (textarea) for the markdown content
   - Markdown preview toggle (rendered HTML with syntax highlighting)
   - Version history dropdown to browse/restore versions
   
2. **Usage** — Deployment notes that persist across versions
   - Markdown editor for explaining how to use this skill
   - Rendered preview mode
   
3. **Examples** — Chat examples (user prompt + assistant response pairs)
   - Add/remove example pairs
   - Collapsible example cards
   - Import user prompts from previous version
   - Expand all / collapse all
   
4. **Notes** — Version-specific annotations
   - Simple text area for notes about this specific version
   - Notes stay linked to their version (not inherited)
   
5. **Files** — Bundled script and reference files
   - Add new files with filename (path), type (script/reference), content
   - Files are displayed in a folder tree structure
   - Edit/delete existing files
   - Sections for scripts and reference files

### 4.4 Tag System

- Create tags with name + color (12 predefined colors)
- Assign multiple tags to a skill
- Filter skills by tag in the sidebar
- Manage tags in Settings (rename, recolor, delete)
- Tag management dialog for bulk operations

### 4.5 Import

#### From Local ZIP
- Upload a `.zip` file containing one or more skill folders
- Each folder must contain a `SKILL.md` file
- Additional files are imported as skill files
- Frontmatter in SKILL.md populates metadata (name, description, license)

#### From GitHub URL
- Paste a GitHub folder URL (e.g., `https://github.com/anthropics/skills/tree/main/skills/pptx`)
- An Edge Function (`github-fetch-skill`) proxies the request to GitHub's API
- Fetches all files recursively from the directory
- Parses SKILL.md frontmatter + bundles additional files
- Works with public repos; private repos need a GitHub token in Settings

### 4.6 Export

Three export formats:

1. **JSON** — Full data export with all versions, annotations, chat examples, usage notes
   - Format version 2
   - Can be re-imported
   
2. **Markdown ZIP** — Each skill as a `.md` file with YAML frontmatter
   - Only exports the active version content
   - Includes tags in frontmatter

3. **SQLite** — Raw database file download
   - Direct export of the sql.js database binary
   - Can be opened with any SQLite viewer

### 4.7 Batch Operations

- Select mode: checkbox selection of multiple skills
- Batch export: Export selected skills as a ZIP with directory-per-skill structure
  - Each skill directory contains SKILL.md + bundled files

### 4.8 GitHub Sync

Bidirectional synchronization with a GitHub repository.

#### Setup
1. User enters a GitHub Personal Access Token (stored in localStorage)
2. User creates a new repo or selects an existing one
3. Repository is marked as "connected"

#### Sync Structure
Two folders in the repository:

```
repo/
├── README.md
├── skills-latest/          # Human-readable skill content
│   ├── my-skill/
│   │   ├── SKILL.md        # Raw markdown body (no frontmatter)
│   │   ├── scripts/
│   │   │   └── analyze.py
│   │   └── config.yaml
│   └── another-skill/
│       └── SKILL.md
└── skills-data/            # Machine-readable full data
    ├── my-skill.json       # Full skill data with all versions
    └── another-skill.json
```

#### Sync Logic
- **Push**: Exports all local skills to both folders via GitHub Git API (blobs → tree → commit)
- **Pull**: Reads `skills-data/*.json` files, compares with local data
- **Conflict detection**: When both local and remote have changes to the same skill (different `updated_at`)
- **Conflict resolution dialog**: Shows local vs remote with word counts, timestamps
  - Options: Keep local, Keep remote, Keep both (creates a copy)
- Skills are matched by filename (slugified title)

#### GitHub API Usage
- Uses GitHub REST API v3 directly (no library)
- Token stored in localStorage under key `github-config`
- Git Data API for atomic commits (blobs → trees → commits → refs)
- Handles empty repos (creates initial commit with README)

### 4.9 Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl/⌘ + N | New skill |
| Ctrl/⌘ + S | Save current skill |
| Ctrl/⌘ + K | Focus search |
| Ctrl/⌘ + B | New version |
| ↑ / ↓ | Navigate skills list |
| Ctrl/⌘ + 1-4 | Switch editor tabs |
| Ctrl/⌘ + Shift + 1-9 | Toggle tag by index |

### 4.10 Settings

- **GitHub tab**: Token management, repo connection, sync trigger
- **Tags tab**: View/delete tags with skill count
- **Export tab**: JSON, Markdown ZIP, SQLite export buttons
- **Import**: JSON file upload (v2 format)
- **Danger zone**: Clear entire database (with confirmation)

---

## 5. UI Layout

### Overall Structure

```
┌──────────────────────────────────────────────────────┐
│ Header: Logo | GitHub Sync | Settings | Shortcuts    │
├───────────────┬──────────────────────────────────────┤
│               │                                      │
│  Skill List   │          Skill Editor                │
│  (sidebar)    │                                      │
│               │  ┌─────────────────────────────────┐ │
│  - Search     │  │ Title / Description / License   │ │
│  - Sort       │  │ Tags                            │ │
│  - Tag filter │  │ Version selector                │ │
│  - Skills...  │  │                                 │ │
│               │  │ Tabs: Editor|Usage|Ex|Notes|Files│ │
│  [+ New]      │  │                                 │ │
│  [Import]     │  │ Content area                    │ │
│  [Select]     │  │                                 │ │
│               │  └─────────────────────────────────┘ │
├───────────────┴──────────────────────────────────────┤
```

### Design System
- Dark theme by default (can support light mode via CSS variables)
- Semantic color tokens: `--background`, `--foreground`, `--primary`, `--muted`, etc.
- All colors in HSL format via CSS custom properties
- shadcn/ui components as the base component library
- Monospace font for code/file editors

---

## 6. Edge Function: `github-fetch-skill`

A Supabase Edge Function that acts as a proxy for fetching skill data from GitHub.

### Endpoint
`POST /functions/v1/github-fetch-skill`

### Request Body
```json
{
  "githubUrl": "https://github.com/owner/repo/tree/branch/path/to/skill"
}
```

### Behavior
1. Parses the GitHub URL to extract owner, repo, branch, and path
2. Fetches the directory tree from GitHub API (supports both `tree` and `blob` URLs)
3. Recursively fetches all file contents
4. Returns file list with filenames and content

### Response
```json
{
  "success": true,
  "skillTitle": "skill-name",
  "files": [
    { "filename": "SKILL.md", "content": "..." },
    { "filename": "scripts/analyze.py", "content": "..." }
  ]
}
```

### Authentication
- Validates Supabase JWT from the `Authorization` header
- Proxies requests to `github.com` domain

---

## 7. Data Flow Diagrams

### Write Path
```
User Action → React Component → useMutation hook
  → getDatabase() [singleton promise]
  → SQL INSERT/UPDATE/DELETE on in-memory sql.js
  → saveDatabase() → db.export() → IndexedDB.put()
  → onSuccess: invalidateQueries()
  → React Query refetches → UI updates
```

### Read Path
```
Component mounts → useQuery hook → queryFn
  → getDatabase() [singleton promise]
  → SQL SELECT on in-memory sql.js
  → Map raw rows to typed objects
  → Return to React Query cache → render in component
```

### Boot Sequence
```
1. main.tsx: Unregister stale service workers, clear caches
2. App.tsx: Mount QueryClientProvider → DatabaseProvider
3. DatabaseProvider: await getDatabase()
   a. Load WASM from CDN
   b. Load saved bytes from IndexedDB (if any)
   c. Verify schema version
   d. Create/recreate tables
   e. Signal ready
4. Children render: Index.tsx → SkillList + SkillEditor
5. React Query hooks fire → read from now-ready database
```

---

## 8. Critical Implementation Requirements

### 8.1 Database Singleton (Race Condition Prevention)

The database initialization MUST use a **promise-based singleton**:

```typescript
let dbPromise: Promise<Database> | null = null;

export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = createDatabase();
  }
  return dbPromise;
}
```

This prevents the race condition where multiple concurrent callers (DatabaseProvider + React Query hooks) each create separate database instances, causing data loss.

**DO NOT** use this pattern:
```typescript
// BAD - race condition!
let db: Database | null = null;
async function init() {
  if (db) return db;     // Both callers see null
  db = await create();   // Second caller overwrites first
}
```

### 8.2 Schema Versioning

- Store schema version in `settings` table: `('schema_version', '6')`
- On load, check schema version. If incompatible, wipe and recreate
- All columns should have DEFAULT values to prevent insertion failures

### 8.3 WASM Loading

- Load sql.js WASM from CDN (jsDelivr) to avoid service worker MIME-type issues
- Use explicit `locateFile` callback to handle all `.wasm` file requests

### 8.4 PWA Cache Strategy

- Service worker must not cause stale code to persist
- On app load, actively unregister old service workers and clear caches if needed
- Consider network-first for app shell, cache-first for WASM binary

---

## 9. Non-Functional Requirements

- **Offline-first**: App must work without internet (except GitHub sync and GitHub import)
- **Performance**: SQLite queries should be fast (all in-memory). IndexedDB writes are async
- **Data safety**: Every mutation must call `saveDatabase()` to persist to IndexedDB
- **No data loss**: Use proper cascade deletes. Never leave orphaned records
- **Responsive**: Should work on tablet-width screens (mobile is secondary)
- **Accessibility**: Keyboard shortcuts, proper focus management, semantic HTML
- **Dark mode**: Primary theme. Light mode support via CSS variables

---

## 10. File Structure (Recommended)

```
src/
├── components/
│   ├── ui/                    # shadcn/ui base components
│   ├── Header.tsx             # App header with sync + settings buttons
│   ├── SkillList.tsx          # Sidebar skill browser
│   ├── SkillEditor.tsx        # Main editor with tabs
│   ├── SkillFiles.tsx         # Files tab (tree view)
│   ├── SkillUsage.tsx         # Usage tab
│   ├── VersionAnnotations.tsx # Notes tab
│   ├── VersionChatExamples.tsx# Examples tab
│   ├── SkillImportDialog.tsx  # Import from ZIP/GitHub
│   ├── SettingsDialog.tsx     # Settings with GitHub/Tags/Export
│   ├── SyncConflictDialog.tsx # GitHub conflict resolution
│   ├── TagManagementDialog.tsx# Tag CRUD
│   ├── MarkdownPreview.tsx    # Rendered markdown with syntax highlighting
│   └── KeyboardShortcutsDialog.tsx
├── hooks/
│   ├── useDatabaseInit.tsx    # DatabaseProvider context
│   ├── useLocalSkills.tsx     # All data access hooks (queries + mutations)
│   ├── useLocalGitHubSync.tsx # GitHub sync logic
│   └── useKeyboardShortcuts.tsx
├── lib/
│   └── database.ts            # SQLite singleton, schema, save/load/export/import
├── types/
│   └── index.ts               # TypeScript interfaces
├── constants/
│   └── index.ts               # DB names, tag colors, etc.
├── utils/
│   ├── skillExport.ts         # ZIP export logic
│   ├── skillImport.ts         # ZIP/GitHub import parsing
│   ├── markdown.ts            # Markdown utilities
│   ├── clipboard.ts           # Clipboard helpers
│   └── format.ts              # Formatting utilities
├── pages/
│   ├── Index.tsx              # Main page layout
│   └── NotFound.tsx           # 404 page
├── App.tsx                    # Root component with providers
├── main.tsx                   # Entry point with SW cleanup
└── index.css                  # Tailwind + CSS variables
```

---

## 11. Constants

```typescript
export const DB_NAME = 'skill-keep-db';        // IndexedDB database name
export const STORE_NAME = 'sqlite-store';       // IndexedDB object store
export const DB_KEY = 'database';               // Key for the SQLite binary in IDB
export const DEFAULT_TAG_COLOR = '#6366f1';     // Indigo
export const TAG_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4',
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7', '#ec4899', '#64748b'
];
```

---

## 12. Dependencies

### Required
- `react`, `react-dom` — UI framework
- `typescript` — Type safety
- `vite` — Build tool
- `tailwindcss`, `tailwindcss-animate` — Styling
- `@tanstack/react-query` — Data fetching/caching layer
- `react-router-dom` — Routing
- `sql.js` — SQLite in WASM
- `idb` — IndexedDB wrapper
- `jszip` — ZIP import/export
- `lucide-react` — Icons
- `sonner` — Toast notifications
- `highlight.js` — Syntax highlighting in markdown preview
- `dompurify` — Sanitize rendered HTML
- shadcn/ui components (Radix primitives)

### For PWA
- A service worker solution (e.g., `vite-plugin-pwa` with Workbox, or a custom service worker)

---

## 13. Summary

Skill Keep is a **browser-based, offline-first skill/prompt manager** that:

1. Stores everything in an **in-browser SQLite database** (no server required)
2. Is an **installable PWA** that works offline
3. Supports **versioning** of skill content with full history
4. Allows **bundling files** (scripts + references) alongside each skill
5. Provides **tag-based organization** with color coding
6. Enables **GitHub synchronization** for backup and sharing
7. Supports **import** from ZIP files and GitHub URLs
8. Exports in **JSON, Markdown, and SQLite** formats
9. Features **keyboard shortcuts** for power users
10. Uses a **dark-first design** with a clean, functional UI
