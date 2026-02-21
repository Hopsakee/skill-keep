import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useTags, useSkills } from '@/hooks/useLocalSkills';
import { useGitHubSync } from '@/hooks/useLocalGitHubSync';
import { getDatabase, saveDatabase, generateId, clearDatabase } from '@/lib/database';
import { DEFAULT_TAG_COLOR } from '@/constants';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, FileJson, FileText, Github, Plus, Check, Loader2, Unlink, Key, RefreshCw, Database, Upload, AlertTriangle } from 'lucide-react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

function escapeYamlString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
}

interface SkillFullData {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  tags: Array<{ name: string; color: string }>;
  usage_explanation: string | null;
  versions: Array<{
    version_number: number;
    content: string;
    is_active: boolean;
    created_at: string;
    annotation: string | null;
    chat_examples: Array<{ role: 'user' | 'assistant'; content: string }>;
  }>;
}

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { tags, deleteTag } = useTags();
  const { skills } = useSkills();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    config, repos, username, isLoading, isSyncing, tokenInput, setTokenInput,
    connectWithToken, createRepo, connectRepo, disconnect, sync,
  } = useGitHubSync();

  const [newRepoName, setNewRepoName] = useState('skill-keep');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (open && config?.token && !config.connected && !username) {}
  }, [open, config, username]);

  const getTagSkillCount = (tagId: string) => {
    return skills.filter((s) => s.tags?.some((t) => t.id === tagId)).length;
  };

  const getLocalSkillsFullData = async (): Promise<SkillFullData[]> => {
    const db = await getDatabase();
    const skillsRes = db.exec('SELECT id, title, created_at, updated_at FROM skills');
    const versionsRes = db.exec('SELECT id, skill_id, content, version_number, is_active, created_at FROM skill_versions ORDER BY version_number ASC');
    const tagsRes = db.exec('SELECT id, name, color FROM tags');
    const linksRes = db.exec('SELECT skill_id, tag_id FROM skill_tags');
    const annotationsRes = db.exec('SELECT version_id, note FROM version_annotations');
    const chatExamplesRes = db.exec('SELECT version_id, messages FROM chat_examples');
    const usageRes = db.exec('SELECT skill_id, explanation FROM skill_usage');

    if (!skillsRes[0]) return [];

    const versions = versionsRes[0]?.values || [];
    const allTags = tagsRes[0]?.values || [];
    const links = linksRes[0]?.values || [];
    const annotations = annotationsRes[0]?.values || [];
    const chatExamples = chatExamplesRes[0]?.values || [];
    const usageData = usageRes[0]?.values || [];

    const result: SkillFullData[] = [];

    for (const row of skillsRes[0].values) {
      const [id, title, created_at, updated_at] = row as string[];
      
      const skillVersions = versions
        .filter((v) => v[1] === id)
        .map((v) => {
          const versionId = v[0] as string;
          const annotation = annotations.find((a) => a[0] === versionId);
          const chatExample = chatExamples.find((c) => c[0] === versionId);
          
          let parsedMessages: Array<{ role: 'user' | 'assistant'; content: string }> = [];
          if (chatExample) {
            try {
              const messagesRaw = chatExample[1];
              if (typeof messagesRaw === 'string') parsedMessages = JSON.parse(messagesRaw);
            } catch { parsedMessages = []; }
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

      const tagIds = links.filter((l) => l[0] === id).map((l) => l[1]);
      const skillTags = allTags
        .filter((t) => tagIds.includes(t[0]))
        .map((t) => ({ name: t[1] as string, color: (t[2] as string) || DEFAULT_TAG_COLOR }));

      const usage = usageData.find((u) => u[0] === id);

      result.push({
        id, title, created_at, updated_at,
        tags: skillTags,
        usage_explanation: usage ? (usage[1] as string | null) : null,
        versions: skillVersions,
      });
    }

    return result;
  };

  const exportAsJson = async () => {
    const fullData = await getLocalSkillsFullData();
    const exportData = { version: 2, exportedAt: new Date().toISOString(), skills: fullData };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-keep-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsMarkdown = async () => {
    const zip = new JSZip();
    const fullData = await getLocalSkillsFullData();
    for (const s of fullData) {
      const activeVersion = s.versions.find(v => v.is_active) || s.versions[s.versions.length - 1];
      const frontmatter = [
        '---', `title: "${escapeYamlString(s.title)}"`,
        `tags: [${s.tags?.map((t) => `"${escapeYamlString(t.name)}"`).join(', ') || ''}]`,
        `created: ${s.created_at}`, `updated: ${s.updated_at}`,
        `version: ${activeVersion?.version_number || 1}`, '---', '',
      ].join('\n');
      const content = frontmatter + (activeVersion?.content || '');
      const fileName = `${s.title.replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '-')}.md`;
      zip.file(fileName, content);
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-keep-${new Date().toISOString().split('T')[0]}.zip`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsSqlite = async () => {
    const db = await getDatabase();
    const data = db.export();
    const blob = new Blob([data], { type: 'application/x-sqlite3' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `skill-keep-${new Date().toISOString().split('T')[0]}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      await clearDatabase();
      queryClient.invalidateQueries();
      toast({ title: 'Database cleared', description: 'The local database has been emptied.' });
      onOpenChange(false);
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear database:', error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not clear database.' });
    } finally {
      setIsClearing(false);
    }
  };

  const handleImportJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      if (data.version === 2 && (Array.isArray(data.skills) || Array.isArray(data.prompts))) {
        const db = await getDatabase();
        const items = data.skills || data.prompts;
        
        for (const skill of items as SkillFullData[]) {
          const skillId = skill.id || generateId();
          const now = new Date().toISOString();

          db.run('INSERT OR REPLACE INTO skills (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [
            skillId, skill.title, skill.created_at || now, skill.updated_at || now,
          ]);

          for (const version of skill.versions) {
            const versionId = generateId();
            db.run(
              'INSERT INTO skill_versions (id, skill_id, content, version_number, is_active, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              [versionId, skillId, version.content, version.version_number, version.is_active ? 1 : 0, version.created_at || now]
            );
            if (version.annotation) {
              db.run('INSERT INTO version_annotations (id, version_id, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
                generateId(), versionId, version.annotation, now, now,
              ]);
            }
            if (version.chat_examples && version.chat_examples.length > 0) {
              db.run('INSERT INTO chat_examples (id, version_id, messages, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
                generateId(), versionId, JSON.stringify(version.chat_examples), now, now,
              ]);
            }
          }

          if (skill.usage_explanation) {
            db.run('INSERT INTO skill_usage (id, skill_id, explanation, created_at, updated_at) VALUES (?, ?, ?, ?, ?)', [
              generateId(), skillId, skill.usage_explanation, now, now,
            ]);
          }

          for (const tag of skill.tags) {
            const existingTag = db.exec('SELECT id FROM tags WHERE name = ?', [tag.name]);
            let tagId: string;
            if (existingTag[0]?.values[0]) {
              tagId = existingTag[0].values[0][0] as string;
            } else {
              tagId = generateId();
              db.run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [tagId, tag.name, tag.color || DEFAULT_TAG_COLOR, now]);
            }
            db.run('INSERT OR IGNORE INTO skill_tags (id, skill_id, tag_id) VALUES (?, ?, ?)', [generateId(), skillId, tagId]);
          }
        }

        await saveDatabase();
        queryClient.invalidateQueries();
        toast({ title: 'Import complete', description: `${items.length} skills imported.` });
      } else {
        toast({ variant: 'destructive', title: 'Invalid format', description: 'This file does not have the correct format.' });
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast({ variant: 'destructive', title: 'Import failed', description: 'Could not import the file.' });
    }
    event.target.value = '';
  };

  const handleConnectToken = async () => {
    if (tokenInput.trim()) await connectWithToken(tokenInput.trim());
  };

  const handleCreateRepo = async () => { await createRepo(newRepoName); };

  const handleConnectRepo = () => {
    if (selectedRepo) connectRepo(selectedRepo);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>Manage tags, GitHub sync and export</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="github" className="mt-4">
          <TabsList className="w-full">
            <TabsTrigger value="github" className="flex-1">GitHub</TabsTrigger>
            <TabsTrigger value="tags" className="flex-1">Tags</TabsTrigger>
            <TabsTrigger value="export" className="flex-1">Export</TabsTrigger>
          </TabsList>

          <TabsContent value="github" className="mt-4">
            <div className="space-y-4">
              {config?.connected ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-4">
                    <Github className="h-5 w-5" />
                    <div className="flex-1">
                      <div className="font-medium">{config.owner}/{config.repo}</div>
                      <div className="text-sm text-muted-foreground">Connected</div>
                    </div>
                    <Check className="h-5 w-5 text-green-600" />
                  </div>
                  <Button onClick={sync} disabled={isSyncing} className="w-full">
                    {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                    Sync with GitHub
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Skills are saved as Markdown files. Conflicts are merged on pull.
                  </p>
                  <Button variant="outline" onClick={disconnect} className="w-full">
                    <Unlink className="mr-2 h-4 w-4" />
                    Disconnect repository
                  </Button>
                </div>
              ) : username ? (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Logged in as <span className="font-medium text-foreground">{username}</span>
                  </div>
                  {repos.length > 0 && (
                    <div className="space-y-2">
                      <Label>Choose existing repository</Label>
                      <div className="flex gap-2">
                        <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                          <SelectTrigger className="flex-1"><SelectValue placeholder="Select repository..." /></SelectTrigger>
                          <SelectContent>
                            {repos.map((repo) => (
                              <SelectItem key={repo.full_name} value={repo.full_name}>{repo.full_name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleConnectRepo} disabled={!selectedRepo}>Connect</Button>
                      </div>
                    </div>
                  )}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border" /></div>
                    <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">or</span></div>
                  </div>
                  <div className="space-y-2">
                    <Label>Create new repository</Label>
                    <div className="flex gap-2">
                      <Input value={newRepoName} onChange={(e) => setNewRepoName(e.target.value)} placeholder="skill-keep" />
                      <Button onClick={handleCreateRepo} disabled={!newRepoName.trim() || isLoading}>
                        <Plus className="mr-1 h-4 w-4" />Create
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">Creates a private repository under {username}</p>
                  </div>
                  <Button variant="outline" onClick={disconnect} className="w-full">Use different token</Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Connect a GitHub repository to automatically sync your skills. 
                    You need a Personal Access Token with 'repo' permissions.
                  </p>
                  {isLoading ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-2">
                      <Label>GitHub Personal Access Token</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="ghp_xxxxxxxxxxxx" className="pl-9" />
                        </div>
                        <Button onClick={handleConnectToken} disabled={!tokenInput.trim()}>Connect</Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <a href="https://github.com/settings/tokens/new?scopes=repo&description=Skill%20Keep" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                          Create a token
                        </a>
                        {' '}with 'repo' permissions. Your token is stored locally.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="tags" className="mt-4">
            <ScrollArea className="h-64">
              {tags.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">No tags created yet</div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div key={tag.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{tag.name}</Badge>
                        <span className="text-sm text-muted-foreground">{getTagSkillCount(tag.id)} skills</span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete tag?</AlertDialogTitle>
                            <AlertDialogDescription>The tag "{tag.name}" will be removed from all skills.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteTag(tag.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="export" className="mt-4">
            <div className="space-y-6">
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium">Export</h4>
                  <p className="text-xs text-muted-foreground">Export all your skills including version history, notes and chat examples.</p>
                </div>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={exportAsJson}>
                    <FileJson className="mr-2 h-4 w-4" />Download as JSON<span className="ml-auto text-xs text-muted-foreground">Full data</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={exportAsSqlite}>
                    <Database className="mr-2 h-4 w-4" />Download as SQLite<span className="ml-auto text-xs text-muted-foreground">Database file</span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={exportAsMarkdown}>
                    <FileText className="mr-2 h-4 w-4" />Download as Markdown<span className="ml-auto text-xs text-muted-foreground">Active versions only</span>
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium">Import</h4>
                  <p className="text-xs text-muted-foreground">Import skills from a previously exported JSON file.</p>
                </div>
                <div>
                  <Label htmlFor="import-json" className="cursor-pointer">
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <span><Upload className="mr-2 h-4 w-4" />Import JSON file</span>
                    </Button>
                  </Label>
                  <Input id="import-json" type="file" accept=".json" className="hidden" onChange={handleImportJson} />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <h4 className="text-sm font-medium text-destructive">Clear database</h4>
                  <p className="text-xs text-muted-foreground">Clear the local database for a clean import or sync.</p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" disabled={isClearing}>
                      {isClearing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
                      Clear database
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Clear database?</AlertDialogTitle>
                      <AlertDialogDescription>All local data will be permanently deleted. Make sure you have a backup via export or GitHub sync before proceeding.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleClearDatabase} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Yes, clear everything</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
