import JSZip from 'jszip';
import { getDatabase, saveDatabase, generateId } from '@/lib/database';

export interface ImportedSkillFile {
  filename: string;
  content: string;
}

export interface ParsedSkill {
  title: string;
  description: string;
  license: string;
  skillMdContent: string; // The SKILL.md body (without frontmatter)
  files: ImportedSkillFile[]; // All other files (scripts, references)
}

interface FrontmatterFields {
  name: string;
  description: string;
  license: string;
  body: string;
}

/**
 * Parse frontmatter from a SKILL.md string.
 * Extracts name, description, license and the body content.
 */
function parseSkillMd(raw: string): FrontmatterFields {
  const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { name: '', description: '', license: '', body: raw.trim() };
  }
  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  const extract = (key: string) => {
    // Handle quoted: key: "value" or unquoted: key: value, and multiline with |
    const quoted = frontmatter.match(new RegExp(`${key}:\\s*"([^"]*)"`, 'm'));
    if (quoted) return quoted[1].trim();
    const unquoted = frontmatter.match(new RegExp(`${key}:\\s*([^\\n]+)`, 'm'));
    if (unquoted) return unquoted[1].trim();
    return '';
  };

  return {
    name: extract('name'),
    description: extract('description'),
    license: extract('license'),
    body,
  };
}

/**
 * Determine file_type for a bundled file.
 * Files inside a "scripts/" folder (at any depth) are always "script".
 * Otherwise, infer by extension.
 */
export function inferFileType(filename: string): 'script' | 'reference' {
  const parts = filename.split('/');
  // If the first path segment is "scripts", treat as script regardless of extension
  if (parts.length > 1 && parts[0].toLowerCase() === 'scripts') return 'script';
  const scriptExts = ['.py', '.js', '.ts', '.sh', '.rb', '.go', '.java', '.cs', '.cpp', '.c', '.rs', '.php'];
  const basename = parts[parts.length - 1];
  const dotIdx = basename.lastIndexOf('.');
  const ext = dotIdx >= 0 ? basename.substring(dotIdx).toLowerCase() : '';
  return scriptExts.includes(ext) ? 'script' : 'reference';
}

/**
 * Parse a ZIP file containing one or more skill folders.
 */
export async function parseSkillZip(zipFile: File): Promise<ParsedSkill[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const skills: ParsedSkill[] = [];

  const groups = new Map<string, Map<string, string>>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    const parts = path.split('/');
    const folder = parts.length > 1 ? parts[0] : '__root__';
    const filename = parts.slice(1).join('/') || parts[0];

    if (!groups.has(folder)) {
      groups.set(folder, new Map());
    }

    try {
      const content = await entry.async('text');
      groups.get(folder)!.set(filename, content);
    } catch {
      // Binary file — skip
    }
  }

  for (const [folder, fileMap] of groups.entries()) {
    const skillMdRaw = fileMap.get('SKILL.md') || fileMap.get('skill.md') || '';
    const { name: frontmatterName, description, license, body } = parseSkillMd(skillMdRaw);

    const title =
      frontmatterName ||
      (folder === '__root__' ? zipFile.name.replace(/\.zip$/i, '') : folder);

    const bundledFiles: ImportedSkillFile[] = [];
    for (const [filename, content] of fileMap.entries()) {
      if (filename.toLowerCase() === 'skill.md') continue;
      bundledFiles.push({ filename, content });
    }

    skills.push({ title, description, license, skillMdContent: body, files: bundledFiles });
  }

  return skills;
}

/**
 * Parse a flat list of files from GitHub (SKILL.md + bundled files).
 */
export function parseSkillFromGitHub(
  skillTitle: string,
  rawFiles: Array<{ filename: string; content: string }>
): ParsedSkill {
  const skillMdFile = rawFiles.find((f) => f.filename.toLowerCase() === 'skill.md');
  const { name: frontmatterName, description, license, body } = parseSkillMd(skillMdFile?.content || '');

  const bundledFiles = rawFiles.filter((f) => f.filename.toLowerCase() !== 'skill.md');

  return {
    title: frontmatterName || skillTitle,
    description,
    license,
    skillMdContent: body,
    files: bundledFiles,
  };
}

/**
 * Save a parsed skill into the local SQLite database.
 */
export async function saveSkillToDatabase(skill: ParsedSkill): Promise<string> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const promptId = generateId();
  const versionId = generateId();

  db.run(
    'INSERT INTO prompts (id, title, description, license, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [promptId, skill.title, skill.description || '', skill.license || '', now, now]
  );

  db.run(
    'INSERT INTO prompt_versions (id, prompt_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [versionId, promptId, skill.skillMdContent, 1, 1, now]
  );

  for (const file of skill.files) {
    db.run(
      'INSERT OR IGNORE INTO skill_files (id, prompt_id, filename, file_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [generateId(), promptId, file.filename, inferFileType(file.filename), file.content, now, now]
    );
  }

  await saveDatabase();
  return promptId;
}
