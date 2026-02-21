// Application constants

// Database
export const DB_NAME = 'skill-keep-db';
export const LEGACY_DB_NAME = 'prompt-vault-db';
export const STORE_NAME = 'sqlite-store';
export const DB_KEY = 'database';

// GitHub sync
export const GITHUB_CONFIG_KEY = 'github-config';
export const SKILLS_FOLDER = 'skills';

// Tag colors palette
export const TAG_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#6366f1', // indigo (default)
  '#8b5cf6', // violet
  '#a855f7', // purple
  '#ec4899', // pink
  '#64748b', // slate
] as const;

export const DEFAULT_TAG_COLOR = '#6366f1';

// Editor tabs
export const EDITOR_TABS = ['editor', 'usage', 'examples', 'notes'] as const;
export type EditorTab = typeof EDITOR_TABS[number];
