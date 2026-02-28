import initSqlJs, { Database } from 'sql.js';
import { openDB, IDBPDatabase } from 'idb';
import { DB_NAME, STORE_NAME, DB_KEY, DEFAULT_TAG_COLOR } from '@/constants';

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

export async function initDatabase(): Promise<Database> {
  console.log('[database] initDatabase called, db exists:', !!db);
  if (db) return db;

  const wasmUrl = (file: string) =>
    file.endsWith('.wasm')
      ? 'https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/sql-wasm.wasm'
      : `https://cdn.jsdelivr.net/npm/sql.js@1.13.0/dist/${file}`;

  const SQL = await initSqlJs({ locateFile: wasmUrl });

  const savedData = await loadFromIndexedDB();
  console.log('[database] savedData from IndexedDB:', savedData ? `${savedData.length} bytes` : 'null');

  if (savedData) {
    db = new SQL.Database(savedData);
    
    // Check if this is a compatible schema (v2 has the schema_version setting)
    let isCompatible = false;
    try {
      const versionCheck = db.exec("SELECT value FROM settings WHERE key = 'schema_version'");
      const version = versionCheck[0]?.values?.[0]?.[0];
      isCompatible = version === '5';
      console.log('[database] Schema version check:', version, 'compatible:', isCompatible);
    } catch (e) {
      console.log('[database] Schema version check failed:', e);
    }
    if (!isCompatible) {
      console.log('[database] Incompatible schema detected, recreating database');
      db.close();
      db = new SQL.Database();
      const idb = await getIDB();
      await idb.delete(STORE_NAME, DB_KEY);
    }
  } else {
    console.log('[database] No saved data, creating fresh database');
    db = new SQL.Database();
  }

  // Ensure all tables exist and mark schema version
  createTables();

  return db;
}

function createTables(): void {
  if (!db) return;
  console.log('[database] Creating/verifying tables');
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

  // Mark schema version so future loads know this is a compatible database
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('schema_version', '5')");

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
