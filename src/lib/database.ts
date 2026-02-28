import initSqlJs, { Database } from 'sql.js';
import { openDB, IDBPDatabase } from 'idb';
import { DB_NAME, STORE_NAME, DB_KEY, DEFAULT_TAG_COLOR } from '@/constants';

// ── IndexedDB helpers ──────────────────────────────────────────────

let idbConnection: IDBPDatabase | null = null;

async function getIDB(): Promise<IDBPDatabase> {
  if (!idbConnection) {
    idbConnection = await openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return idbConnection;
}

async function saveToIndexedDB(db: Database): Promise<void> {
  const data = db.export();
  const idb = await getIDB();
  await idb.put(STORE_NAME, data, DB_KEY);
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await getIDB();
  const data = await idb.get(STORE_NAME, DB_KEY);
  return data || null;
}

// ── Promise-based singleton ────────────────────────────────────────

let dbPromise: Promise<Database> | null = null;

/**
 * Returns the single Database instance. Safe to call concurrently —
 * all callers share the same initialization promise.
 */
export function getDatabase(): Promise<Database> {
  if (!dbPromise) {
    dbPromise = createDatabase();
  }
  return dbPromise;
}

async function createDatabase(): Promise<Database> {
  const SQL = await initSqlJs({
    locateFile: (file: string) =>
      file.endsWith('.wasm')
        ? 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm'
        : `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`,
  });

  const savedData = await loadFromIndexedDB();
  let db: Database;

  if (savedData) {
    db = new SQL.Database(savedData);

    // Verify schema compatibility
    let isCompatible = false;
    try {
      const versionCheck = db.exec("SELECT value FROM settings WHERE key = 'schema_version'");
      isCompatible = versionCheck[0]?.values?.[0]?.[0] === '6';
    } catch {
      // Table doesn't exist — incompatible
    }

    if (!isCompatible) {
      db.close();
      db = new SQL.Database();
      const idb = await getIDB();
      await idb.delete(STORE_NAME, DB_KEY);
    }
  } else {
    db = new SQL.Database();
  }

  createTables(db);
  return db;
}

// ── Schema ─────────────────────────────────────────────────────────

function createTables(db: Database): void {
  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      title TEXT DEFAULT '',
      description TEXT DEFAULT '',
      license TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_versions (
      id TEXT PRIMARY KEY,
      skill_id TEXT DEFAULT '',
      content TEXT DEFAULT '',
      version_number INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      color TEXT DEFAULT '${DEFAULT_TAG_COLOR}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_tags (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      tag_id TEXT NOT NULL,
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
      UNIQUE(skill_id, tag_id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS version_annotations (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL UNIQUE,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (version_id) REFERENCES skill_versions(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_examples (
      id TEXT PRIMARY KEY,
      version_id TEXT NOT NULL UNIQUE,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (version_id) REFERENCES skill_versions(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_usage (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL UNIQUE,
      explanation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_files (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_type TEXT NOT NULL DEFAULT 'reference',
      content TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE,
      UNIQUE(skill_id, filename)
    )
  `);

  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '6')");
  saveToIndexedDB(db);
}

// ── Public utilities ───────────────────────────────────────────────

export async function saveDatabase(): Promise<void> {
  const db = await getDatabase();
  await saveToIndexedDB(db);
}

export function generateId(): string {
  return crypto.randomUUID();
}

export async function clearDatabase(): Promise<void> {
  const idb = await getIDB();
  await idb.delete(STORE_NAME, DB_KEY);

  if (dbPromise) {
    const db = await dbPromise;
    db.close();
  }
  dbPromise = null;
}

// ── Export / Import ────────────────────────────────────────────────

export async function exportDatabaseAsJson(): Promise<string> {
  const db = await getDatabase();

  const skills = db.exec('SELECT * FROM skills ORDER BY updated_at DESC');
  const versions = db.exec('SELECT * FROM skill_versions');
  const tags = db.exec('SELECT * FROM tags');
  const skillTags = db.exec('SELECT * FROM skill_tags');
  const annotations = db.exec('SELECT * FROM version_annotations');
  const chatExamples = db.exec('SELECT * FROM chat_examples');
  const skillUsage = db.exec('SELECT * FROM skill_usage');
  const skillFiles = db.exec('SELECT * FROM skill_files ORDER BY file_type, filename');

  return JSON.stringify({
    version: 1,
    exportedAt: new Date().toISOString(),
    skills: skills[0]?.values || [],
    skill_versions: versions[0]?.values || [],
    tags: tags[0]?.values || [],
    skill_tags: skillTags[0]?.values || [],
    version_annotations: annotations[0]?.values || [],
    chat_examples: chatExamples[0]?.values || [],
    skill_usage: skillUsage[0]?.values || [],
    skill_files: skillFiles[0]?.values || [],
  }, null, 2);
}

interface MarkdownSkill {
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

function parseMarkdownFrontmatter(markdown: string): MarkdownSkill | null {
  const frontmatterMatch = markdown.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) return null;

  const frontmatter = frontmatterMatch[1];
  const content = frontmatterMatch[2].trim();

  const titleMatch = frontmatter.match(/title:\s*"?([^"\n]+)"?/);
  const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
  const createdMatch = frontmatter.match(/created:\s*(.+)/);
  const updatedMatch = frontmatter.match(/updated:\s*(.+)/);

  const title = titleMatch ? titleMatch[1].replace(/\\"/g, '"') : 'Untitled';
  const tagsStr = tagsMatch ? tagsMatch[1] : '';
  const tags = tagsStr
    .split(',')
    .map((t) => t.trim().replace(/^["']|["']$/g, ''))
    .filter((t) => t.length > 0);

  return {
    title,
    content,
    tags,
    created_at: createdMatch ? createdMatch[1].trim() : new Date().toISOString(),
    updated_at: updatedMatch ? updatedMatch[1].trim() : new Date().toISOString(),
  };
}

export async function importMarkdownSkills(markdownFiles: Array<{ name: string; content: string }>): Promise<number> {
  const db = await getDatabase();
  let imported = 0;

  for (const file of markdownFiles) {
    const parsed = parseMarkdownFrontmatter(file.content);
    if (!parsed) continue;

    const skillId = generateId();
    const versionId = generateId();
    const now = new Date().toISOString();

    db.run(
      'INSERT INTO skills (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [skillId, parsed.title, parsed.created_at || now, parsed.updated_at || now]
    );

    db.run(
      'INSERT INTO skill_versions (id, skill_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [versionId, skillId, parsed.content, 1, 1, parsed.created_at || now]
    );

    for (const tagName of parsed.tags) {
      const existingTag = db.exec('SELECT id FROM tags WHERE name = ?', [tagName]);
      let tagId: string;

      if (existingTag[0]?.values[0]) {
        tagId = existingTag[0].values[0][0] as string;
      } else {
        tagId = generateId();
        db.run('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', [tagId, tagName, now]);
      }

      db.run('INSERT OR IGNORE INTO skill_tags (id, skill_id, tag_id) VALUES (?, ?, ?)', [
        generateId(),
        skillId,
        tagId,
      ]);
    }

    imported++;
  }

  await saveToIndexedDB(db);
  return imported;
}
