import JSZip from 'jszip';
import { getDatabase } from '@/lib/database';
import type { Prompt, SkillFile } from '@/types';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'skill';
}

interface SkillExportData {
  prompt: Prompt;
  files: SkillFile[];
}

async function loadSkillData(promptIds: string[]): Promise<SkillExportData[]> {
  const db = await getDatabase();

  const result: SkillExportData[] = [];

  for (const promptId of promptIds) {
    const promptResult = db.exec(
      'SELECT id, title, created_at, updated_at FROM prompts WHERE id = ?',
      [promptId]
    );
    if (!promptResult[0]?.values[0]) continue;

    const cols = promptResult[0].columns;
    const row = promptResult[0].values[0];
    const prompt: Record<string, unknown> = {};
    cols.forEach((col, i) => { prompt[col] = row[i]; });

    // Active version
    const versionResult = db.exec(
      'SELECT id, prompt_id, content, version_number, is_active, created_at FROM prompt_versions WHERE prompt_id = ? AND is_active = 1',
      [promptId]
    );
    if (versionResult[0]?.values[0]) {
      const vcols = versionResult[0].columns;
      const vrow = versionResult[0].values[0];
      const version: Record<string, unknown> = {};
      vcols.forEach((col, i) => { version[col] = vrow[i]; });
      version.is_active = Boolean(version.is_active);
      prompt.active_version = version;
    }

    // Skill files
    const filesResult = db.exec(
      'SELECT id, prompt_id, filename, file_type, content, created_at, updated_at FROM skill_files WHERE prompt_id = ? ORDER BY file_type, filename',
      [promptId]
    );
    const files: SkillFile[] = [];
    if (filesResult[0]) {
      const fcols = filesResult[0].columns;
      for (const frow of filesResult[0].values) {
        const file: Record<string, unknown> = {};
        fcols.forEach((col, i) => { file[col] = frow[i]; });
        files.push(file as unknown as SkillFile);
      }
    }

    result.push({ prompt: prompt as unknown as Prompt, files });
  }

  return result;
}

function buildSkillMd(prompt: Prompt): string {
  const content = prompt.active_version?.content || '';
  const now = prompt.updated_at || new Date().toISOString();
  return `---
name: "${prompt.title.replace(/"/g, '\\"')}"
updated: ${now}
---

${content}`;
}

export async function downloadSkillsAsZip(promptIds: string[], zipName = 'skills-export'): Promise<void> {
  const skills = await loadSkillData(promptIds);
  const zip = new JSZip();

  // Track used slugs to handle collisions
  const usedSlugs = new Map<string, number>();

  for (const { prompt, files } of skills) {
    let slug = slugify(prompt.title);
    const count = usedSlugs.get(slug) ?? 0;
    usedSlugs.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;

    const folder = zip.folder(slug)!;
    folder.file('SKILL.md', buildSkillMd(prompt));

    for (const file of files) {
      folder.file(file.filename, file.content);
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${zipName}.zip`;
  a.click();
  URL.revokeObjectURL(url);
}
