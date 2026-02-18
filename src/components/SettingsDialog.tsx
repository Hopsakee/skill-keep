import { useState, useEffect } from 'react';
import JSZip from 'jszip';
import { useTags, usePrompts } from '@/hooks/useLocalPrompts';
import { useGitHubSync } from '@/hooks/useLocalGitHubSync';
import { getDatabase, saveDatabase, generateId, clearDatabase } from '@/lib/database';
import { DEFAULT_TAG_COLOR } from '@/constants';
import { useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, FileJson, FileText, Github, Plus, Check, Loader2, Unlink, Key, RefreshCw, Database, Upload, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';

// Escape YAML string values to prevent injection
function escapeYamlString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

// Full prompt data structure matching GitHub sync
interface PromptFullData {
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
  const { prompts } = usePrompts();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const {
    config,
    repos,
    username,
    isLoading,
    isSyncing,
    tokenInput,
    setTokenInput,
    connectWithToken,
    createRepo,
    connectRepo,
    disconnect,
    sync,
  } = useGitHubSync();

  const [newRepoName, setNewRepoName] = useState('prompt-vault');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [isClearing, setIsClearing] = useState(false);

  useEffect(() => {
    if (open && config?.token && !config.connected && !username) {
      // Token exists but not connected - fetch repos
    }
  }, [open, config, username]);

  const getTagPromptCount = (tagId: string) => {
    return prompts.filter((p) => p.tags?.some((t) => t.id === tagId)).length;
  };

  // Get all prompts with full data from SQLite (matching GitHub sync structure)
  const getLocalPromptsFullData = async (): Promise<PromptFullData[]> => {
    const db = await getDatabase();
    const promptsRes = db.exec('SELECT id, title, created_at, updated_at FROM prompts');
    const versionsRes = db.exec('SELECT id, prompt_id, content, version_number, is_active, created_at FROM prompt_versions ORDER BY version_number ASC');
    const tagsRes = db.exec('SELECT id, name, color FROM tags');
    const linksRes = db.exec('SELECT prompt_id, tag_id FROM prompt_tags');
    const annotationsRes = db.exec('SELECT version_id, note FROM version_annotations');
    const chatExamplesRes = db.exec('SELECT version_id, messages FROM chat_examples');
    const usageRes = db.exec('SELECT prompt_id, explanation FROM prompt_usage');

    if (!promptsRes[0]) return [];

    const versions = versionsRes[0]?.values || [];
    const allTags = tagsRes[0]?.values || [];
    const links = linksRes[0]?.values || [];
    const annotations = annotationsRes[0]?.values || [];
    const chatExamples = chatExamplesRes[0]?.values || [];
    const usageData = usageRes[0]?.values || [];

    const result: PromptFullData[] = [];

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
      const promptTags = allTags
        .filter((t) => tagIds.includes(t[0]))
        .map((t) => ({ name: t[1] as string, color: (t[2] as string) || DEFAULT_TAG_COLOR }));

      // Get usage explanation
      const usage = usageData.find((u) => u[0] === id);

      result.push({
        id,
        title,
        created_at,
        updated_at,
        tags: promptTags,
        usage_explanation: usage ? (usage[1] as string | null) : null,
        versions: promptVersions,
      });
    }

    return result;
  };

  const exportAsJson = async () => {
    const fullData = await getLocalPromptsFullData();
    const exportData = {
      version: 2,
      exportedAt: new Date().toISOString(),
      prompts: fullData,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-vault-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsMarkdown = async () => {
    const zip = new JSZip();
    const fullData = await getLocalPromptsFullData();

    for (const p of fullData) {
      const activeVersion = p.versions.find(v => v.is_active) || p.versions[p.versions.length - 1];
      
      const frontmatter = [
        '---',
        `title: "${escapeYamlString(p.title)}"`,
        `tags: [${p.tags?.map((t) => `"${escapeYamlString(t.name)}"`).join(', ') || ''}]`,
        `created: ${p.created_at}`,
        `updated: ${p.updated_at}`,
        `version: ${activeVersion?.version_number || 1}`,
        '---',
        '',
      ].join('\n');

      const content = frontmatter + (activeVersion?.content || '');
      const fileName = `${p.title.replace(/[^a-zA-Z0-9\-_ ]/g, '').replace(/\s+/g, '-')}.md`;
      
      zip.file(fileName, content);
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prompt-vault-${new Date().toISOString().split('T')[0]}.zip`;
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
    a.download = `prompt-vault-${new Date().toISOString().split('T')[0]}.sqlite`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleClearDatabase = async () => {
    setIsClearing(true);
    try {
      await clearDatabase();
      queryClient.invalidateQueries();
      toast({ title: 'Database gewist', description: 'De lokale database is leeggemaakt.' });
      onOpenChange(false);
      // Reload the page to reinitialize everything
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear database:', error);
      toast({ variant: 'destructive', title: 'Fout', description: 'Kon database niet wissen.' });
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
      
      // Check if it's the new format (version 2) or old format
      if (data.version === 2 && Array.isArray(data.prompts)) {
        const db = await getDatabase();
        
        for (const prompt of data.prompts as PromptFullData[]) {
          const promptId = prompt.id || generateId();
          const now = new Date().toISOString();

          // Insert prompt
          db.run('INSERT OR REPLACE INTO prompts (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)', [
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

            // Insert chat examples if exist
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

          // Insert tags
          for (const tag of prompt.tags) {
            const existingTag = db.exec('SELECT id FROM tags WHERE name = ?', [tag.name]);
            let tagId: string;

            if (existingTag[0]?.values[0]) {
              tagId = existingTag[0].values[0][0] as string;
            } else {
              tagId = generateId();
              db.run('INSERT INTO tags (id, name, color, created_at) VALUES (?, ?, ?, ?)', [tagId, tag.name, tag.color || DEFAULT_TAG_COLOR, now]);
            }

            db.run('INSERT OR IGNORE INTO prompt_tags (id, prompt_id, tag_id) VALUES (?, ?, ?)', [
              generateId(),
              promptId,
              tagId,
            ]);
          }
        }

        await saveDatabase();
        queryClient.invalidateQueries();
        toast({ title: 'Import voltooid', description: `${data.prompts.length} prompts geïmporteerd.` });
      } else {
        toast({ variant: 'destructive', title: 'Ongeldig formaat', description: 'Dit bestand heeft niet het juiste formaat.' });
      }
    } catch (error) {
      console.error('Import failed:', error);
      toast({ variant: 'destructive', title: 'Import mislukt', description: 'Kon het bestand niet importeren.' });
    }
    
    // Reset the input
    event.target.value = '';
  };

  const handleConnectToken = async () => {
    if (tokenInput.trim()) {
      await connectWithToken(tokenInput.trim());
    }
  };

  const handleCreateRepo = async () => {
    await createRepo(newRepoName);
  };

  const handleConnectRepo = () => {
    if (selectedRepo) {
      connectRepo(selectedRepo);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Instellingen</DialogTitle>
          <DialogDescription>Beheer tags, GitHub sync en export</DialogDescription>
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
                      <div className="text-sm text-muted-foreground">Gekoppeld</div>
                    </div>
                    <Check className="h-5 w-5 text-green-600" />
                  </div>

                  <Button onClick={sync} disabled={isSyncing} className="w-full">
                    {isSyncing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-4 w-4" />
                    )}
                    Synchroniseren met GitHub
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Prompts worden opgeslagen als Markdown bestanden. Bij pull worden conflicten gemerged.
                  </p>

                  <Button variant="outline" onClick={disconnect} className="w-full">
                    <Unlink className="mr-2 h-4 w-4" />
                    Ontkoppel repository
                  </Button>
                </div>
              ) : username ? (
                <div className="space-y-4">
                  <div className="text-sm text-muted-foreground">
                    Ingelogd als <span className="font-medium text-foreground">{username}</span>
                  </div>

                  {repos.length > 0 && (
                    <div className="space-y-2">
                      <Label>Bestaande repository kiezen</Label>
                      <div className="flex gap-2">
                        <Select value={selectedRepo} onValueChange={setSelectedRepo}>
                          <SelectTrigger className="flex-1">
                            <SelectValue placeholder="Selecteer repository..." />
                          </SelectTrigger>
                          <SelectContent>
                            {repos.map((repo) => (
                              <SelectItem key={repo.full_name} value={repo.full_name}>
                                {repo.full_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button onClick={handleConnectRepo} disabled={!selectedRepo}>
                          Koppel
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">of</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nieuwe repository aanmaken</Label>
                    <div className="flex gap-2">
                      <Input
                        value={newRepoName}
                        onChange={(e) => setNewRepoName(e.target.value)}
                        placeholder="prompt-vault"
                      />
                      <Button onClick={handleCreateRepo} disabled={!newRepoName.trim() || isLoading}>
                        <Plus className="mr-1 h-4 w-4" />
                        Aanmaken
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Maakt een private repository aan onder {username}
                    </p>
                  </div>

                  <Button variant="outline" onClick={disconnect} className="w-full">
                    Andere token gebruiken
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Koppel een GitHub repository om je database automatisch te synchroniseren. 
                    Je hebt een Personal Access Token nodig met 'repo' rechten.
                  </p>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label>GitHub Personal Access Token</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Key className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            type="password"
                            value={tokenInput}
                            onChange={(e) => setTokenInput(e.target.value)}
                            placeholder="ghp_xxxxxxxxxxxx"
                            className="pl-9"
                          />
                        </div>
                        <Button onClick={handleConnectToken} disabled={!tokenInput.trim()}>
                          Verbind
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        <a 
                          href="https://github.com/settings/tokens/new?scopes=repo&description=Prompt%20Vault" 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          Maak een token aan
                        </a>
                        {' '}met 'repo' rechten. Je token wordt lokaal opgeslagen.
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
                <div className="py-8 text-center text-muted-foreground">
                  Nog geen tags aangemaakt
                </div>
              ) : (
                <div className="space-y-2">
                  {tags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between rounded-lg border border-border p-3"
                    >
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{tag.name}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {getTagPromptCount(tag.id)} prompts
                        </span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Tag verwijderen?</AlertDialogTitle>
                            <AlertDialogDescription>
                              De tag "{tag.name}" wordt verwijderd van alle prompts.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuleren</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => deleteTag(tag.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Verwijderen
                            </AlertDialogAction>
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
              {/* Export Section */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium">Exporteren</h4>
                  <p className="text-xs text-muted-foreground">
                    Exporteer al je prompts inclusief versiegeschiedenis, notities en chat voorbeelden.
                  </p>
                </div>
                <div className="space-y-2">
                  <Button variant="outline" className="w-full justify-start" onClick={exportAsJson}>
                    <FileJson className="mr-2 h-4 w-4" />
                    Download als JSON
                    <span className="ml-auto text-xs text-muted-foreground">
                      Volledige data
                    </span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={exportAsSqlite}>
                    <Database className="mr-2 h-4 w-4" />
                    Download als SQLite
                    <span className="ml-auto text-xs text-muted-foreground">
                      Database bestand
                    </span>
                  </Button>
                  <Button variant="outline" className="w-full justify-start" onClick={exportAsMarkdown}>
                    <FileText className="mr-2 h-4 w-4" />
                    Download als Markdown
                    <span className="ml-auto text-xs text-muted-foreground">
                      Alleen actieve versies
                    </span>
                  </Button>
                </div>
              </div>

              {/* Import Section */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-medium">Importeren</h4>
                  <p className="text-xs text-muted-foreground">
                    Importeer prompts uit een eerder geëxporteerd JSON bestand.
                  </p>
                </div>
                <div>
                  <Label htmlFor="import-json" className="cursor-pointer">
                    <Button variant="outline" className="w-full justify-start" asChild>
                      <span>
                        <Upload className="mr-2 h-4 w-4" />
                        Importeer JSON bestand
                      </span>
                    </Button>
                  </Label>
                  <Input
                    id="import-json"
                    type="file"
                    accept=".json"
                    className="hidden"
                    onChange={handleImportJson}
                  />
                </div>
              </div>

              {/* Clear Database Section */}
              <div className="space-y-3 border-t border-border pt-4">
                <div>
                  <h4 className="text-sm font-medium text-destructive">Database wissen</h4>
                  <p className="text-xs text-muted-foreground">
                    Wis de lokale database om een schone import of sync uit te voeren.
                  </p>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-destructive hover:text-destructive" disabled={isClearing}>
                      {isClearing ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <AlertTriangle className="mr-2 h-4 w-4" />
                      )}
                      Database wissen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Database wissen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Alle lokale data wordt permanent verwijderd. Zorg dat je een backup hebt via export of GitHub sync voordat je doorgaat.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearDatabase}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Ja, wis alles
                      </AlertDialogAction>
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
