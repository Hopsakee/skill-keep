import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { getDatabase, saveDatabase, generateId } from '@/lib/database';
import { ConflictInfo } from '@/components/SyncConflictDialog';
import { DEFAULT_TAG_COLOR } from '@/constants';

interface GitHubConfig {
  owner: string;
  repo: string;
  token: string;
  connected: boolean;
}

interface Repo {
  name: string;
  full_name: string;
}

// Full prompt data structure for JSON export
interface PromptFullData {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  tags: Array<{ name: string; color: string }>;
  usage_explanation: string | null;
  skill_files: Array<{
    filename: string;
    file_type: 'script' | 'reference';
    content: string;
  }>;
  versions: Array<{
    version_number: number;
    content: string;
    is_active: boolean;
    created_at: string;
    annotation: string | null;
    chat_examples: Array<{ role: 'user' | 'assistant'; content: string }>;
  }>;
}

// Simplified data for quick push (only active version)
interface PromptSimpleData {
  id: string;
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  version_number: number;
}

interface ParsedMarkdown {
  title: string;
  content: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

const GITHUB_CONFIG_KEY = 'github-config';
const PROMPTS_LATEST_FOLDER = 'prompts-latest';
const PROMPTS_DATA_FOLDER = 'prompts-data';

function sanitizeFilename(title: string): string {
  const filename = title
    .replace(/[^a-zA-Z0-9\-_\s]/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
    .substring(0, 200);
  return filename || `prompt-${Date.now()}`;
}

function countWords(text: string): number {
  return text.split(/\s+/).filter((w) => w.length > 0).length;
}

export function useGitHubSync() {
  const { toast } = useToast();
  const [config, setConfig] = useState<GitHubConfig | null>(null);
  const [repos, setRepos] = useState<Repo[]>([]);
  const [username, setUsername] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [tokenInput, setTokenInput] = useState('');

  // Conflict handling state
  const [conflicts, setConflicts] = useState<ConflictInfo[]>([]);
  const [conflictIndex, setConflictIndex] = useState(0);
  const [conflictResolutions, setConflictResolutions] = useState<Map<string, 'local' | 'remote' | 'both'>>(new Map());
  const [pendingSync, setPendingSync] = useState<{
    remotePrompts: Map<string, PromptFullData>;
    localPrompts: Map<string, PromptFullData>;
  } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(GITHUB_CONFIG_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setConfig(parsed);
        if (parsed.token) fetchUserInfo(parsed.token);
      } catch {
        localStorage.removeItem(GITHUB_CONFIG_KEY);
      }
    }
  }, []);

  const saveConfig = (newConfig: GitHubConfig) => {
    setConfig(newConfig);
    localStorage.setItem(GITHUB_CONFIG_KEY, JSON.stringify(newConfig));
  };

  const headers = (token: string) => ({
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'X-GitHub-Api-Version': '2022-11-28',
  });

  const fetchUserInfo = async (token: string) => {
    try {
      const res = await fetch('https://api.github.com/user', { headers: headers(token) });
      if (res.ok) {
        const user = await res.json();
        setUsername(user.login);
        return user.login;
      }
    } catch (e) {
      console.error('Failed to fetch user:', e);
    }
    return null;
  };

  const fetchRepos = async (token?: string) => {
    const t = token || config?.token;
    if (!t) return;

    setIsLoading(true);
    try {
      const userRes = await fetch('https://api.github.com/user', { headers: headers(t) });
      if (!userRes.ok) {
        toast({ variant: 'destructive', title: 'GitHub fout', description: 'Ongeldige token' });
        return;
      }
      const user = await userRes.json();
      setUsername(user.login);

      const reposRes = await fetch('https://api.github.com/user/repos?per_page=100&sort=updated', {
        headers: headers(t),
      });
      const reposList = await reposRes.json();
      setRepos(reposList.map((r: any) => ({ name: r.name, full_name: r.full_name })));
    } catch (e) {
      console.error('Failed to fetch repos:', e);
      toast({ variant: 'destructive', title: 'Fout', description: 'Kon repositories niet ophalen' });
    } finally {
      setIsLoading(false);
    }
  };

  const connectWithToken = async (token: string) => {
    setIsLoading(true);
    try {
      const user = await fetchUserInfo(token);
      if (user) {
        setTokenInput('');
        await fetchRepos(token);
        saveConfig({ owner: '', repo: '', token, connected: false });
        return true;
      }
      toast({ variant: 'destructive', title: 'Ongeldige token', description: 'Controleer je token' });
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const createRepo = async (repoName: string) => {
    if (!config?.token) return null;

    setIsLoading(true);
    try {
      const res = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: { ...headers(config.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: repoName, description: 'Prompt Vault', private: true, auto_init: true }),
      });
      const newRepo = await res.json();

      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Fout', description: newRepo.message });
        return null;
      }

      toast({ title: 'Repository aangemaakt' });
      const [owner, repo] = newRepo.full_name.split('/');
      saveConfig({ owner, repo, token: config.token, connected: true });
      return newRepo.full_name;
    } catch (e) {
      console.error('Failed to create repo:', e);
      toast({ variant: 'destructive', title: 'Fout', description: 'Kon repository niet aanmaken' });
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const connectRepo = (fullName: string) => {
    if (!config?.token) return;
    const [owner, repo] = fullName.split('/');
    saveConfig({ owner, repo, token: config.token, connected: true });
    toast({ title: 'Repository gekoppeld' });
  };

  const disconnect = () => {
    setConfig(null);
    setUsername(null);
    setRepos([]);
    localStorage.removeItem(GITHUB_CONFIG_KEY);
    toast({ title: 'GitHub ontkoppeld' });
  };

  // Get all prompts with full data from SQLite
  const getLocalPromptsFullData = async (): Promise<Map<string, PromptFullData>> => {
    const db = await getDatabase();
    const promptsRes = db.exec('SELECT id, title, created_at, updated_at FROM prompts');
    const versionsRes = db.exec('SELECT id, prompt_id, content, version_number, is_active, created_at FROM prompt_versions ORDER BY version_number ASC');
    const tagsRes = db.exec('SELECT id, name, color FROM tags');
    const linksRes = db.exec('SELECT prompt_id, tag_id FROM prompt_tags');
    const annotationsRes = db.exec('SELECT version_id, note FROM version_annotations');
    const chatExamplesRes = db.exec('SELECT version_id, messages FROM chat_examples');
    const usageRes = db.exec('SELECT prompt_id, explanation FROM prompt_usage');
    const skillFilesRes = db.exec('SELECT prompt_id, filename, file_type, content FROM skill_files ORDER BY file_type, filename');

    const map = new Map<string, PromptFullData>();
    if (!promptsRes[0]) return map;

    const versions = versionsRes[0]?.values || [];
    const tags = tagsRes[0]?.values || [];
    const links = linksRes[0]?.values || [];
    const annotations = annotationsRes[0]?.values || [];
    const chatExamples = chatExamplesRes[0]?.values || [];
    const usageData = usageRes[0]?.values || [];
    const skillFilesData = skillFilesRes[0]?.values || [];

    for (const row of promptsRes[0].values) {
      const [id, title, created_at, updated_at] = row as string[];
      
      // Get all versions for this prompt
      const promptVersions = versions
        .filter((v) => v[1] === id)
        .map((v) => {
          const versionId = v[0] as string;
          const annotation = annotations.find((a) => a[0] === versionId);
          const chatExample = chatExamples.find((c) => c[0] === versionId);
          
          let parsedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
          if (chatExample) {
            try {
              const messagesRaw = chatExample[1];
              if (typeof messagesRaw === 'string') {
                parsedMessages = JSON.parse(messagesRaw);
              }
            } catch {
              parsedMessages = [];
            }
          }

          return {
            version_number: v[3] as number,
            content: v[2] as string,
            is_active: v[4] === 1,
            created_at: v[5] as string,
            annotation: annotation ? (annotation[1] as string | null) : null,
            chat_examples: parsedMessages,
          };
        });

      // Get tags with colors
      const tagIds = links.filter((l) => l[0] === id).map((l) => l[1]);
      const promptTags = tags
        .filter((t) => tagIds.includes(t[0]))
        .map((t) => ({ name: t[1] as string, color: (t[2] as string) || DEFAULT_TAG_COLOR }));

      // Get usage explanation
      const usage = usageData.find((u) => u[0] === id);

      // Get skill files
      const promptSkillFiles = skillFilesData
        .filter((f) => f[0] === id)
        .map((f) => ({
          filename: f[1] as string,
          file_type: f[2] as 'script' | 'reference',
          content: f[3] as string,
        }));

      const prompt: PromptFullData = {
        id,
        title,
        created_at,
        updated_at,
        tags: promptTags,
        usage_explanation: usage ? (usage[1] as string | null) : null,
        skill_files: promptSkillFiles,
        versions: promptVersions,
      };

      map.set(sanitizeFilename(title), prompt);
    }

    return map;
  };

  // Fetch remote prompts from GitHub (from prompts-data folder)
  const getRemotePrompts = async (): Promise<Map<string, PromptFullData> | null> => {
    if (!config?.connected || !config.token) return null;

    try {
      const repoRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
        headers: headers(config.token),
      });
      if (!repoRes.ok) return null;
      const repoInfo = await repoRes.json();
      const branch = repoInfo.default_branch || 'main';

      const folderRes = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/contents/${PROMPTS_DATA_FOLDER}?ref=${branch}`,
        { headers: headers(config.token) }
      );

      if (!folderRes.ok) return new Map();

      const files = await folderRes.json();
      const jsonFiles = files.filter((f: any) => f.name.endsWith('.json'));

      const map = new Map<string, PromptFullData>();

      await Promise.all(
        jsonFiles.map(async (f: any) => {
          const res = await fetch(f.download_url);
          const content = await res.text();
          try {
            const parsed = JSON.parse(content) as PromptFullData;
            const key = f.name.replace('.json', '');
            map.set(key, parsed);
          } catch {
            console.error('Failed to parse JSON:', f.name);
          }
        })
      );

      return map;
    } catch {
      return null;
    }
  };

  // Push prompts to GitHub (both folders)
  const pushToGitHub = async (prompts: PromptFullData[]) => {
    if (!config?.connected || !config.token) return false;

    const repoRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}`, {
      headers: headers(config.token),
    });
    if (!repoRes.ok) throw new Error('Repository niet toegankelijk');
    const repoInfo = await repoRes.json();
    const branch = repoInfo.default_branch || 'main';

    let refRes = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/git/ref/heads/${branch}`,
      { headers: headers(config.token) }
    );

    if (!refRes.ok) {
      // Initialize empty repo
      const readme = btoa('# Prompt Vault\n\nPrompts synced from Prompt Vault.\n\n- `prompts-latest/`: Raw prompt content for easy usage\n- `prompts-data/`: Full prompt data with all versions and metadata');
      const blobRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
        method: 'POST',
        headers: { ...headers(config.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: readme, encoding: 'base64' }),
      });
      const blob = await blobRes.json();

      const treeRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/trees`, {
        method: 'POST',
        headers: { ...headers(config.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ tree: [{ path: 'README.md', mode: '100644', type: 'blob', sha: blob.sha }] }),
      });
      const tree = await treeRes.json();

      const commitRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/commits`, {
        method: 'POST',
        headers: { ...headers(config.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Initial commit', tree: tree.sha }),
      });
      const commit = await commitRes.json();

      await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/refs`, {
        method: 'POST',
        headers: { ...headers(config.token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: commit.sha }),
      });

      refRes = await fetch(
        `https://api.github.com/repos/${config.owner}/${config.repo}/git/ref/heads/${branch}`,
        { headers: headers(config.token) }
      );
    }

    const ref = await refRes.json();
    const commitSha = ref.object.sha;

    const commitInfoRes = await fetch(
      `https://api.github.com/repos/${config.owner}/${config.repo}/git/commits/${commitSha}`,
      { headers: headers(config.token) }
    );
    const commitInfo = await commitInfoRes.json();

    // Create blobs for both folders — directory per skill with SKILL.md + bundled files
    const tree = await Promise.all(
      prompts.flatMap((p) => {
        const filename = sanitizeFilename(p.title);
        const activeVersion = p.versions.find((v) => v.is_active) || p.versions[p.versions.length - 1];
        
        // SKILL.md content (raw markdown body)
        const skillMdContent = btoa(unescape(encodeURIComponent(activeVersion?.content || '')));
        
        // Full JSON data
        const jsonData = btoa(unescape(encodeURIComponent(JSON.stringify(p, null, 2))));

        const entries: Promise<{ path: string; mode: '100644'; type: 'blob'; sha: string }>[] = [
          // skills-latest/<name>/SKILL.md
          fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
            method: 'POST',
            headers: { ...headers(config.token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: skillMdContent, encoding: 'base64' }),
          })
            .then((res) => res.json())
            .then((blob) => ({
              path: `${PROMPTS_LATEST_FOLDER}/${filename}/SKILL.md`,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: blob.sha,
            })),
          // skills-data/<name>.json
          fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
            method: 'POST',
            headers: { ...headers(config.token), 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: jsonData, encoding: 'base64' }),
          })
            .then((res) => res.json())
            .then((blob) => ({
              path: `${PROMPTS_DATA_FOLDER}/${filename}.json`,
              mode: '100644' as const,
              type: 'blob' as const,
              sha: blob.sha,
            })),
        ];

        // Add bundled skill files alongside SKILL.md
        for (const skillFile of (p.skill_files || [])) {
          const fileContent = btoa(unescape(encodeURIComponent(skillFile.content)));
          entries.push(
            fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/blobs`, {
              method: 'POST',
              headers: { ...headers(config.token), 'Content-Type': 'application/json' },
              body: JSON.stringify({ content: fileContent, encoding: 'base64' }),
            })
              .then((res) => res.json())
              .then((blob) => ({
                path: `${PROMPTS_LATEST_FOLDER}/${filename}/${skillFile.filename}`,
                mode: '100644' as const,
                type: 'blob' as const,
                sha: blob.sha,
              }))
          );
        }

        return entries;
      })
    );

    const newTreeRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/trees`, {
      method: 'POST',
      headers: { ...headers(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ base_tree: commitInfo.tree.sha, tree }),
    });
    const newTree = await newTreeRes.json();

    const newCommitRes = await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/commits`, {
      method: 'POST',
      headers: { ...headers(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: `Sync ${prompts.length} prompts - ${new Date().toISOString()}`,
        tree: newTree.sha,
        parents: [commitSha],
      }),
    });
    const newCommit = await newCommitRes.json();

    await fetch(`https://api.github.com/repos/${config.owner}/${config.repo}/git/refs/heads/${branch}`, {
      method: 'PATCH',
      headers: { ...headers(config.token), 'Content-Type': 'application/json' },
      body: JSON.stringify({ sha: newCommit.sha }),
    });

    return true;
  };

  // Add prompt to local database with full data
  const addPromptToLocal = async (prompt: PromptFullData) => {
    const db = await getDatabase();
    const promptId = prompt.id || generateId();
    const now = new Date().toISOString();

    // Insert prompt
    db.run('INSERT INTO prompts (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [
      promptId,
      prompt.title,
      prompt.created_at || now,
      prompt.updated_at || now,
    ]);

    // Insert all versions
    for (const version of prompt.versions) {
      const versionId = generateId();
      db.run(
        'INSERT INTO prompt_versions (id, prompt_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [versionId, promptId, version.content, version.version_number, version.is_active ? 1 : 0, version.created_at || now]
      );

      // Insert annotation if exists
      if (version.annotation) {
        db.run('INSERT INTO version_annotations (id, version_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          generateId(),
          versionId,
          version.annotation,
          now,
          now,
        ]);
      }

      // Insert chat examples if exists
      if (version.chat_examples && version.chat_examples.length > 0) {
        db.run('INSERT INTO chat_examples (id, version_id, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          generateId(),
          versionId,
          JSON.stringify(version.chat_examples),
          now,
          now,
        ]);
      }
    }

    // Insert tags
    for (const tag of prompt.tags) {
      const existingTag = db.exec('SELECT id FROM tags WHERE name = ?', [tag.name]);
      let tagId: string;
      if (existingTag[0]?.values[0]) {
        tagId = existingTag[0].values[0][0] as string;
      } else {
        tagId = generateId();
        db.run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [tagId, tag.name, tag.color, now]);
      }
      db.run('INSERT OR IGNORE INTO prompt_tags (id, prompt_id, tag_id) VALUES (?, ?, ?)', [
        generateId(),
        promptId,
        tagId,
      ]);
    }

    // Insert usage explanation if exists
    if (prompt.usage_explanation) {
      db.run('INSERT INTO prompt_usage (id, prompt_id, explanation, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
        generateId(),
        promptId,
        prompt.usage_explanation,
        now,
        now,
      ]);
    }

    // Insert skill files if any
    for (const sf of (prompt.skill_files || [])) {
      db.run(
        'INSERT OR REPLACE INTO skill_files (id, prompt_id, filename, file_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId(), promptId, sf.filename, sf.file_type, sf.content, now, now]
      );
    }

    return promptId;
  };

  // Update existing prompt with full data from remote
  const updatePromptFromRemote = async (localPromptId: string, remote: PromptFullData) => {
    const db = await getDatabase();
    const now = new Date().toISOString();

    // Update prompt metadata
    db.run('UPDATE prompts SET title = ?, updated_at = ? WHERE id = ?', [remote.title, now, localPromptId]);

    // Delete existing versions, annotations, chat examples
    const existingVersions = db.exec('SELECT id FROM prompt_versions WHERE prompt_id = ?', [localPromptId]);
    for (const v of existingVersions[0]?.values || []) {
      const versionId = v[0] as string;
      db.run('DELETE FROM version_annotations WHERE version_id = ?', [versionId]);
      db.run('DELETE FROM chat_examples WHERE version_id = ?', [versionId]);
    }
    db.run('DELETE FROM prompt_versions WHERE prompt_id = ?', [localPromptId]);

    // Insert all versions from remote
    for (const version of remote.versions) {
      const versionId = generateId();
      db.run(
        'INSERT INTO prompt_versions (id, prompt_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [versionId, localPromptId, version.content, version.version_number, version.is_active ? 1 : 0, version.created_at || now]
      );

      if (version.annotation) {
        db.run('INSERT INTO version_annotations (id, version_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          generateId(),
          versionId,
          version.annotation,
          now,
          now,
        ]);
      }

      if (version.chat_examples && version.chat_examples.length > 0) {
        db.run('INSERT INTO chat_examples (id, version_id, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
          generateId(),
          versionId,
          JSON.stringify(version.chat_examples),
          now,
          now,
        ]);
      }
    }

    // Update tags
    db.run('DELETE FROM prompt_tags WHERE prompt_id = ?', [localPromptId]);
    for (const tag of remote.tags) {
      const existingTag = db.exec('SELECT id FROM tags WHERE name = ?', [tag.name]);
      let tagId: string;
      if (existingTag[0]?.values[0]) {
        tagId = existingTag[0].values[0][0] as string;
        // Update tag color if needed
        db.run('UPDATE tags SET color = ? WHERE id = ?', [tag.color, tagId]);
      } else {
        tagId = generateId();
        db.run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [tagId, tag.name, tag.color, now]);
      }
      db.run('INSERT OR IGNORE INTO prompt_tags (id, prompt_id, tag_id) VALUES (?, ?, ?)', [
        generateId(),
        localPromptId,
        tagId,
      ]);
    }

    // Update usage explanation
    db.run('DELETE FROM prompt_usage WHERE prompt_id = ?', [localPromptId]);
    if (remote.usage_explanation) {
      db.run('INSERT INTO prompt_usage (id, prompt_id, explanation, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
        generateId(),
        localPromptId,
        remote.usage_explanation,
        now,
        now,
      ]);
    }

    // Update skill files
    db.run('DELETE FROM skill_files WHERE prompt_id = ?', [localPromptId]);
    for (const sf of (remote.skill_files || [])) {
      db.run(
        'INSERT INTO skill_files (id, prompt_id, filename, file_type, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [generateId(), localPromptId, sf.filename, sf.file_type, sf.content, now, now]
      );
    }
  };

  // Execute merge after conflict resolution
  const executeMerge = useCallback(
    async (
      remotePrompts: Map<string, PromptFullData>,
      localPrompts: Map<string, PromptFullData>,
      resolutions: Map<string, 'local' | 'remote' | 'both'>
    ) => {
      const db = await getDatabase();
      let added = 0;
      let updated = 0;

      for (const [key, remote] of remotePrompts) {
        const local = localPrompts.get(key);
        const resolution = resolutions.get(key);

        if (!local) {
          // New remote prompt - add to local
          await addPromptToLocal(remote);
          added++;
        } else if (resolution === 'remote') {
          // User chose remote - update local with all remote data
          await updatePromptFromRemote(local.id, remote);
          updated++;
        } else if (resolution === 'both') {
          // Keep both - add remote as new prompt with suffix
          const newPrompt = { ...remote, id: generateId(), title: `${remote.title} (GitHub)` };
          await addPromptToLocal(newPrompt);
          added++;
        }
        // If resolution === 'local' or no conflict, keep local as is
      }

      await saveDatabase();

      // Get final list of all prompts for push
      const finalPrompts = await getLocalPromptsFullData();
      return { added, updated, prompts: Array.from(finalPrompts.values()) };
    },
    []
  );

  // Combined sync: pull changes, resolve conflicts, then push
  const sync = async () => {
    if (!config?.connected || !config.token) {
      toast({ variant: 'destructive', title: 'Niet gekoppeld', description: 'Koppel eerst een repository in instellingen' });
      return false;
    }

    setIsSyncing(true);
    try {
      const [remotePrompts, localPrompts] = await Promise.all([getRemotePrompts(), getLocalPromptsFullData()]);

      if (!remotePrompts) {
        toast({ variant: 'destructive', title: 'Fout', description: 'Kon GitHub niet bereiken' });
        return false;
      }

      // Find conflicts (compare active version content)
      const foundConflicts: ConflictInfo[] = [];

      for (const [key, remote] of remotePrompts) {
        const local = localPrompts.get(key);

        if (local) {
          const localActiveVersion = local.versions.find((v) => v.is_active) || local.versions[local.versions.length - 1];
          const remoteActiveVersion = remote.versions.find((v) => v.is_active) || remote.versions[remote.versions.length - 1];

          if (localActiveVersion?.content.trim() !== remoteActiveVersion?.content.trim()) {
            foundConflicts.push({
              title: remote.title,
              filename: key,
              local: {
                content: localActiveVersion?.content || '',
                updated_at: local.updated_at,
                wordCount: countWords(localActiveVersion?.content || ''),
              },
              remote: {
                content: remoteActiveVersion?.content || '',
                updated_at: remote.updated_at,
                wordCount: countWords(remoteActiveVersion?.content || ''),
              },
            });
          }
        }
      }

      if (foundConflicts.length > 0) {
        // Store pending sync data and show conflict dialog
        setConflicts(foundConflicts);
        setConflictIndex(0);
        setConflictResolutions(new Map());
        setPendingSync({ remotePrompts, localPrompts });
        setIsSyncing(false);
        return false;
      }

      // No conflicts - merge and push
      const { added, prompts } = await executeMerge(remotePrompts, localPrompts, new Map());

      if (prompts.length > 0) {
        await pushToGitHub(prompts);
      }

      toast({ 
        title: 'Sync voltooid', 
        description: added > 0 ? `${added} nieuwe prompts, ${prompts.length} totaal gepusht` : `${prompts.length} prompts gesynchroniseerd`
      });

      if (added > 0) {
        window.location.reload();
      }

      return true;
    } catch (e) {
      console.error('Sync failed:', e);
      toast({
        variant: 'destructive',
        title: 'Sync mislukt',
        description: e instanceof Error ? e.message : 'Onbekende fout',
      });
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle conflict resolution
  const resolveConflict = useCallback(
    async (choice: 'local' | 'remote' | 'both') => {
      const currentConflict = conflicts[conflictIndex];
      const newResolutions = new Map(conflictResolutions);
      newResolutions.set(currentConflict.filename, choice);
      setConflictResolutions(newResolutions);

      if (conflictIndex < conflicts.length - 1) {
        // More conflicts to resolve
        setConflictIndex(conflictIndex + 1);
      } else {
        // All conflicts resolved - execute merge and push
        if (pendingSync) {
          setIsSyncing(true);
          try {
            const { added, updated, prompts } = await executeMerge(
              pendingSync.remotePrompts,
              pendingSync.localPrompts,
              newResolutions
            );

            if (prompts.length > 0) {
              await pushToGitHub(prompts);
            }

            toast({
              title: 'Sync voltooid',
              description: `${added} toegevoegd, ${updated} bijgewerkt, ${prompts.length} gepusht`,
            });

            // Reset state
            setConflicts([]);
            setConflictIndex(0);
            setConflictResolutions(new Map());
            setPendingSync(null);

            window.location.reload();
          } catch (e) {
            toast({ variant: 'destructive', title: 'Sync mislukt', description: e instanceof Error ? e.message : 'Onbekende fout' });
          } finally {
            setIsSyncing(false);
          }
        }
      }
    },
    [conflicts, conflictIndex, conflictResolutions, pendingSync, executeMerge, toast]
  );

  const cancelConflictResolution = useCallback(() => {
    setConflicts([]);
    setConflictIndex(0);
    setConflictResolutions(new Map());
    setPendingSync(null);
    toast({ title: 'Sync geannuleerd' });
  }, [toast]);

  return {
    config,
    repos,
    username,
    isLoading,
    isSyncing,
    tokenInput,
    setTokenInput,
    fetchRepos,
    connectWithToken,
    createRepo,
    connectRepo,
    disconnect,
    sync,
    // Conflict handling
    conflicts,
    conflictIndex,
    resolveConflict,
    cancelConflictResolution,
  };
}
