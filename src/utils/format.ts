// Formatting utilities

/**
 * Format a date string for display in the prompt list
 */
export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Vandaag';
  if (diffDays === 1) return 'Gisteren';
  if (diffDays < 7) return `${diffDays} dagen geleden`;
  return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
}

/**
 * Format a date string for display in version history
 */
export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Format a date string with full details
 */
export function formatFullDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Count words in a text string
 */
export function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

/**
 * Get preview lines from a text string
 */
export function getPreviewLines(text: string, lines: number = 2): string {
  const allLines = text.split('\n');
  if (allLines.length <= lines) return text;
  return allLines.slice(0, lines).join('\n') + '...';
}

/**
 * Sanitize a filename for use in file systems
 */
export function sanitizeFilename(title: string): string {
  const filename = title
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 200);
  return filename || `prompt-${Date.now()}`;
}

/**
 * Escape a string for use in YAML frontmatter
 */
export function escapeYaml(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
