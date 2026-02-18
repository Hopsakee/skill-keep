import type { ParsedMarkdown, PromptExportData } from '@/types';
import { escapeYaml } from './format';

/**
 * Convert a prompt to markdown format with YAML frontmatter
 */
export function toMarkdown(prompt: PromptExportData): string {
  return `---
title: "${escapeYaml(prompt.title)}"
tags: [${prompt.tags.map((t) => `"${escapeYaml(t)}"`).join(', ')}]
created: "${prompt.created_at}"
updated: "${prompt.updated_at}"
version: ${prompt.version_number}
---

${prompt.content}`;
}

/**
 * Parse markdown with YAML frontmatter into a structured object
 */
export function parseMarkdown(content: string): ParsedMarkdown | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter = match[1];
  const body = match[2].trim();

  const titleMatch = frontmatter.match(/title:\s*"?([^"\n]+)"?/);
  const tagsMatch = frontmatter.match(/tags:\s*\[(.*?)\]/);
  const createdMatch = frontmatter.match(/created:\s*"?([^"\n]+)"?/);
  const updatedMatch = frontmatter.match(/updated:\s*"?([^"\n]+)"?/);

  return {
    title: titleMatch ? titleMatch[1].replace(/\\"/g, '"') : 'Untitled',
    content: body,
    tags: tagsMatch
      ? tagsMatch[1]
          .split(',')
          .map((t) => t.trim().replace(/^["']|["']$/g, ''))
          .filter((t) => t.length > 0)
      : [],
    created_at: createdMatch ? createdMatch[1].trim().replace(/"/g, '') : new Date().toISOString(),
    updated_at: updatedMatch ? updatedMatch[1].trim().replace(/"/g, '') : new Date().toISOString(),
  };
}
