import JSZip from 'jszip';
import { getDatabase } from '@/lib/database';
import type { Skill, SkillFile } from '@/types';

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'skill';
}

interface SkillExportData {
  skill: Skill;
  files: SkillFile[];
}

async function loadSkillData(skillIds: string[]): Promise<SkillExportData[]> {
  const db = await getDatabase();
  const result: SkillExportData[] = [];

  for (const skillId of skillIds) {
    const skillResult = db.exec(
      'SELECT id, title, description, license, created_at, updated_at FROM skills WHERE id = ?',
      [skillId]
    );
    if (!skillResult[0]?.values[0]) continue;

    const cols = skillResult[0].columns;
    const row = skillResult[0].values[0];
    const skill: Record<string, unknown> = {};
    cols.forEach((col, i) => { skill[col] = row[i]; });

    const versionResult = db.exec(
      'SELECT id, skill_id, content, version_number, is_active, created_at FROM skill_versions WHERE skill_id = ? AND is_active = 1',
      [skillId]
    );
    if (versionResult[0]?.values[0]) {
      const vcols = versionResult[0].columns;
      const vrow = versionResult[0].values[0];
      const version: Record<string, unknown> = {};
      vcols.forEach((col, i) => { version[col] = vrow[i]; });
      version.is_active = Boolean(version.is_active);
      skill.active_version = version;
    }

    const filesResult = db.exec(
      'SELECT id, skill_id, filename, file_type, content, created_at, updated_at FROM skill_files WHERE skill_id = ? ORDER BY file_type, filename',
      [skillId]
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

    result.push({ skill: skill as unknown as Skill, files });
  }

  return result;
}

function buildSkillMd(skill: Skill): string {
  const content = skill.active_version?.content || '';
  const now = skill.updated_at || new Date().toISOString();
  const lines = [`---`, `name: "${skill.title.replace(/"/g, '\\"')}"`];
  if (skill.description) lines.push(`description: "${skill.description.replace(/"/g, '\\"')}"`);
  if (skill.license) lines.push(`license: "${skill.license.replace(/"/g, '\\"')}"`);
  lines.push(`updated: ${now}`);
  lines.push(`---`);
  lines.push('');
  lines.push(content);
  return lines.join('\n');
}

export async function downloadSkillsAsZip(skillIds: string[], zipName = 'skills-export'): Promise<void> {
  const skills = await loadSkillData(skillIds);
  const zip = new JSZip();
  const usedSlugs = new Map<string, number>();

  for (const { skill, files } of skills) {
    let slug = slugify(skill.title);
    const count = usedSlugs.get(slug) ?? 0;
    usedSlugs.set(slug, count + 1);
    if (count > 0) slug = `${slug}-${count}`;

    const folder = zip.folder(slug)!;
    folder.file('SKILL.md', buildSkillMd(skill));

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
