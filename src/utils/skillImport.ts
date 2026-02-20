import JSZip from 'jszip';
import { getDatabase, saveDatabase, generateId } from '@/lib/database';

export interface ImportedSkillFile {
  filename: string;
  content: string;
}

export interface ParsedSkill {
  title: string;
  skillMdContent: string; // The SKILL.md body (without frontmatter)
  files: ImportedSkillFile[]; // All other files (scripts, references)
}

/**
 * Parse frontmatter from a SKILL.md string.
 * Returns { name, body } where body is the content after frontmatter.
 */
function parseSkillMd(raw: string): { name: string; body: string } {
  const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!fmMatch) {
    return { name: '', body: raw.trim() };
  }
  const frontmatter = fmMatch[1];
  const body = fmMatch[2].trim();

  const nameMatch = frontmatter.match(/name:\s*"?([^"\n]+)"?/);
  const name = nameMatch ? nameMatch[1].trim() : '';
  return { name, body };
}

/**
 * Determine file_type for a bundled file based on extension.
 */
export function inferFileType(filename: string): 'script' | 'reference' {
  const scriptExts = ['.py', '.js', '.ts', '.sh', '.rb', '.go', '.java', '.cs', '.cpp', '.c', '.rs', '.php'];
  const ext = filename.substring(filename.lastIndexOf('.')).toLowerCase();
  return scriptExts.includes(ext) ? 'script' : 'reference';
}

/**
 * Parse a ZIP file containing one or more skill folders.
 * Each folder should have SKILL.md + optional bundled files.
 * If no folder structure — treat all files as a single skill named after the ZIP filename.
 */
export async function parseSkillZip(zipFile: File): Promise<ParsedSkill[]> {
  const zip = await JSZip.loadAsync(zipFile);
  const skills: ParsedSkill[] = [];

  // Group files by top-level folder (or root)
  const groups = new Map<string, Map<string, string>>();

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;

    const parts = path.split('/');
    const folder = parts.length > 1 ? parts[0] : '__root__';
    const filename = parts.slice(1).join('/') || parts[0];

    if (!groups.has(folder)) {
      groups.set(folder, new Map());
    }

    // Only text files
    try {
      const content = await entry.async('text');
      groups.get(folder)!.set(filename, content);
    } catch {
      // Binary file — skip
    }
  }

  for (const [folder, fileMap] of groups.entries()) {
    const skillMdRaw = fileMap.get('SKILL.md') || fileMap.get('skill.md') || '';
    const { name: frontmatterName, body } = parseSkillMd(skillMdRaw);

    const title =
      frontmatterName ||
      (folder === '__root__' ? zipFile.name.replace(/\.zip$/i, '') : folder);

    const bundledFiles: ImportedSkillFile[] = [];
    for (const [filename, content] of fileMap.entries()) {
      if (filename.toLowerCase() === 'skill.md') continue;
      bundledFiles.push({ filename, content });
    }

    skills.push({
      title,
      skillMdContent: body,
      files: bundledFiles,
    });
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
  const skillMdFile = rawFiles.find(
    (f) => f.filename.toLowerCase() === 'skill.md'
  );
  const { name: frontmatterName, body } = parseSkillMd(skillMdFile?.content || '');

  const bundledFiles = rawFiles.filter((f) => f.filename.toLowerCase() !== 'skill.md');

  return {
    title: frontmatterName || skillTitle,
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
    'INSERT INTO prompts (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)',
    [promptId, skill.title, now, now]
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
