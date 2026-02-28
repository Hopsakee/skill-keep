import initSqlJs, { Database } from 'sql.js';
import { openDB, IDBPDatabase } from 'idb';
import { DB_NAME, LEGACY_DB_NAME, STORE_NAME, DB_KEY, DEFAULT_TAG_COLOR } from '@/constants';

let db: Database | null = null;
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

async function saveToIndexedDB(): Promise<void> {
  if (!db) return;
  const data = db.export();
  const idb = await getIDB();
  await idb.put(STORE_NAME, data, DB_KEY);
}

async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  const idb = await getIDB();
  const data = await idb.get(STORE_NAME, DB_KEY);
  return data || null;
}

async function migrateFromLegacyIDB(): Promise<void> {
  try {
    const legacyIdb = await openDB(LEGACY_DB_NAME, 1);
    const data = await legacyIdb.get(STORE_NAME, DB_KEY);
    legacyIdb.close();

    if (data) {
      const newIdb = await getIDB();
      const existing = await newIdb.get(STORE_NAME, DB_KEY);
      if (!existing) {
        await newIdb.put(STORE_NAME, data, DB_KEY);
      }
      // Delete legacy database
      const deleteReq = indexedDB.deleteDatabase(LEGACY_DB_NAME);
      await new Promise<void>((resolve) => {
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => resolve();
        deleteReq.onblocked = () => resolve();
      });
    }
  } catch {
    // Legacy DB doesn't exist or can't be opened — nothing to migrate
  }
}

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  // Migrate data from old 'prompt-vault-db' to new 'skill-keep-db'
  await migrateFromLegacyIDB();

  const wasmUrl = file =>
    file.endsWith('.wasm')
      ? 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm'
      : `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`;

  const SQL = await initSqlJs({ locateFile: wasmUrl });

  const savedData = await loadFromIndexedDB();
  
  if (savedData) {
    db = new SQL.Database(savedData);
  } else {
    db = new SQL.Database();
  }

  // Always ensure all tables exist (IF NOT EXISTS is safe for existing DBs)
  createTables();

  return db;
}

function createTables(): void {
  if (!db) return;

  db.run(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      license TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS skill_versions (
      id TEXT PRIMARY KEY,
      skill_id TEXT NOT NULL,
      content TEXT NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
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

  saveToIndexedDB();
}

export async function getDatabase(): Promise<Database> {
  if (!db) {
    return initDatabase();
  }
  return db;
}

export async function saveDatabase(): Promise<void> {
  await saveToIndexedDB();
}

export function generateId(): string {
  return crypto.randomUUID();
}

export async function clearDatabase(): Promise<void> {
  const idb = await getIDB();
  await idb.delete(STORE_NAME, DB_KEY);
  
  if (db) {
    db.close();
    db = null;
  }
}

export async function exportDatabaseAsJson(): Promise<string> {
  const database = await getDatabase();
  
  const skills = database.exec('SELECT * FROM skills ORDER BY updated_at DESC');
  const versions = database.exec('SELECT * FROM skill_versions');
  const tags = database.exec('SELECT * FROM tags');
  const skillTags = database.exec('SELECT * FROM skill_tags');
  const annotations = database.exec('SELECT * FROM version_annotations');
  const chatExamples = database.exec('SELECT * FROM chat_examples');
  const skillUsage = database.exec('SELECT * FROM skill_usage');
  const skillFiles = database.exec('SELECT * FROM skill_files ORDER BY file_type, filename');

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

export async function migrateDatabase(): Promise<void> {
  const database = await getDatabase();

  // ── Migration: rename old "prompt" tables to "skill" tables ──────────
  const oldTables = [
    { old: 'prompts', new: 'skills' },
    { old: 'prompt_versions', new: 'skill_versions' },
    { old: 'prompt_tags', new: 'skill_tags' },
    { old: 'prompt_usage', new: 'skill_usage' },
  ];

  for (const { old: oldName, new: newName } of oldTables) {
    const oldExists = database.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${oldName}'`
    );
    const newExists = database.exec(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='${newName}'`
    );
    if (oldExists[0]?.values?.length && !newExists[0]?.values?.length) {
      database.run(`ALTER TABLE ${oldName} RENAME TO ${newName}`);
    }
  }

  // Rename prompt_id columns to skill_id where needed (SQLite >=3.25 supports RENAME COLUMN)
  // We try it; if the column doesn't exist we skip silently.
  const columnsToRename = [
    { table: 'skill_versions', old: 'prompt_id', new: 'skill_id' },
    { table: 'skill_tags', old: 'prompt_id', new: 'skill_id' },
    { table: 'skill_usage', old: 'prompt_id', new: 'skill_id' },
    { table: 'skill_files', old: 'prompt_id', new: 'skill_id' },
  ];

  for (const { table, old: oldCol, new: newCol } of columnsToRename) {
    try {
      // Check if old column exists
      database.exec(`SELECT ${oldCol} FROM ${table} LIMIT 0`);
      // Old column exists — rename it
      database.run(`ALTER TABLE ${table} RENAME COLUMN ${oldCol} TO ${newCol}`);
    } catch {
      // Column doesn't exist (already renamed or table doesn't exist yet) — skip
    }
  }

  await saveToIndexedDB();

  // Check if skill_usage table exists
  const tableCheck = database.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='skill_usage'"
  );
  
  if (!tableCheck[0]?.values?.length) {
    database.run(`
      CREATE TABLE IF NOT EXISTS skill_usage (
        id TEXT PRIMARY KEY,
        skill_id TEXT NOT NULL UNIQUE,
        explanation TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      )
    `);
    await saveToIndexedDB();
  }

  // Add color column to tags if it doesn't exist
  try {
    database.exec("SELECT color FROM tags LIMIT 1");
  } catch {
    database.run(`ALTER TABLE tags ADD COLUMN color TEXT DEFAULT '${DEFAULT_TAG_COLOR}'`);
    await saveToIndexedDB();
  }

  // Add skill_files table if it doesn't exist
  const skillFilesCheck = database.exec(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='skill_files'"
  );
  if (!skillFilesCheck[0]?.values?.length) {
    database.run(`
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
    await saveToIndexedDB();
  }

  // Add description and license columns to skills if they don't exist
  try {
    database.exec("SELECT description FROM skills LIMIT 1");
  } catch {
    database.run("ALTER TABLE skills ADD COLUMN description TEXT DEFAULT ''");
    await saveToIndexedDB();
  }
  try {
    database.exec("SELECT license FROM skills LIMIT 1");
  } catch {
    database.run("ALTER TABLE skills ADD COLUMN license TEXT DEFAULT ''");
    await saveToIndexedDB();
  }
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
  const database = await getDatabase();
  let imported = 0;

  for (const file of markdownFiles) {
    const parsed = parseMarkdownFrontmatter(file.content);
    if (!parsed) continue;

    const skillId = generateId();
    const versionId = generateId();
    const now = new Date().toISOString();

    database.run(
      'INSERT INTO skills (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
      [skillId, parsed.title, parsed.created_at || now, parsed.updated_at || now]
    );

    database.run(
      'INSERT INTO skill_versions (id, skill_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [versionId, skillId, parsed.content, 1, 1, parsed.created_at || now]
    );

    for (const tagName of parsed.tags) {
      const existingTag = database.exec('SELECT id FROM tags WHERE name = ?', [tagName]);
      let tagId: string;

      if (existingTag[0]?.values[0]) {
        tagId = existingTag[0].values[0][0] as string;
      } else {
        tagId = generateId();
        database.run('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', [tagId, tagName, now]);
      }

      database.run('INSERT OR IGNORE INTO skill_tags (id, skill_id, tag_id) VALUES (?, ?, ?)', [
        generateId(),
        skillId,
        tagId,
      ]);
    }

    imported++;
  }

  await saveToIndexedDB();
  return imported;
}
