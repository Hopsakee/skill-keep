// Core domain types for the Prompt Vault application

export interface Prompt {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
  active_version?: PromptVersion;
}

export interface PromptVersion {
  id: string;
  prompt_id: string;
  content: string;
  version_number: number;
  is_active: boolean;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatExample {
  id: string;
  version_id: string;
  messages: ChatMessage[];
}

export interface VersionAnnotation {
  id: string;
  version_id: string;
  note: string | null;
  version_number?: number;
  created_at?: string;
}

export interface PromptUsageData {
  id: string;
  prompt_id: string;
  explanation: string | null;
}

// Bundled skill files (Level 3 resources)
export interface SkillFile {
  id: string;
  prompt_id: string;
  filename: string;
  file_type: 'script' | 'reference';
  content: string;
  created_at: string;
  updated_at: string;
}

// GitHub sync types
export interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  connected: boolean;
}

export interface GitHubRepo {
  name: string;
  full_name: string;
}

export interface PromptExportData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  version_number: number;
}

export interface ParsedMarkdown {
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

// Conflict resolution types
export interface ConflictInfo {
  title: string;
  filename: string;
  local: { content: string; updated_at: string; wordCount: number };
  remote: { content: string; updated_at: string; wordCount: number };
}

// Chat example format for version-specific examples
export interface VersionChatExample {
  userPrompt: string;
  assistantResponse: string;
}
