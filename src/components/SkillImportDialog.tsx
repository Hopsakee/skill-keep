import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, Github, Loader2, FileArchive, CheckCircle2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { parseSkillZip, parseSkillFromGitHub, saveSkillToDatabase } from '@/utils/skillImport';

interface SkillImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: (skillId: string) => void;
}

export function SkillImportDialog({ open, onOpenChange, onImported }: SkillImportDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [githubUrl, setGithubUrl] = useState('');
  const [isImportingGitHub, setIsImportingGitHub] = useState(false);
  const [isImportingZip, setIsImportingZip] = useState(false);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [importedCount, setImportedCount] = useState<number | null>(null);

  const handleZipSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setZipFile(file);
      setImportedCount(null);
    }
  };

  const handleZipImport = async () => {
    if (!zipFile) return;
    setIsImportingZip(true);
    try {
      const skills = await parseSkillZip(zipFile);
      if (skills.length === 0) {
        toast({ variant: 'destructive', title: 'No skills found', description: 'ZIP must contain SKILL.md file(s).' });
        return;
      }

      let lastId = '';
      for (const skill of skills) {
        lastId = await saveSkillToDatabase(skill);
      }

      setImportedCount(skills.length);
      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({ title: `${skills.length} skill${skills.length > 1 ? 's' : ''} imported` });

      if (lastId && onImported) onImported(lastId);
      if (skills.length === 1) {
        setTimeout(() => onOpenChange(false), 1200);
      }
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'Import failed', description: String(e) });
    } finally {
      setIsImportingZip(false);
    }
  };

  const handleGitHubImport = async () => {
    if (!githubUrl.trim()) return;
    setIsImportingGitHub(true);
    try {
      const { data, error } = await supabase.functions.invoke('github-fetch-skill', {
        body: { githubUrl: githubUrl.trim() },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Unknown error');
      }

      const skill = parseSkillFromGitHub(data.skillTitle, data.files);
      const promptId = await saveSkillToDatabase(skill);

      queryClient.invalidateQueries({ queryKey: ['prompts'] });
      toast({ title: `Skill "${skill.title}" imported`, description: `${data.files.length} file(s) imported` });

      if (onImported) onImported(promptId);
      setTimeout(() => onOpenChange(false), 800);
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: 'GitHub import failed', description: String(e) });
    } finally {
      setIsImportingGitHub(false);
    }
  };

  const handleClose = () => {
    setGithubUrl('');
    setZipFile(null);
    setImportedCount(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Skill</DialogTitle>
          <DialogDescription>
            Import a skill from your local PC (ZIP) or directly from a GitHub folder URL.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="local" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="local" className="flex-1 gap-2">
              <Upload className="h-4 w-4" />
              Local ZIP
            </TabsTrigger>
            <TabsTrigger value="github" className="flex-1 gap-2">
              <Github className="h-4 w-4" />
              GitHub URL
            </TabsTrigger>
          </TabsList>

          {/* ── Local ZIP tab ─────────────────────────── */}
          <TabsContent value="local" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>ZIP file</Label>
              <p className="text-xs text-muted-foreground">
                Upload a ZIP that contains one or more skill folders. Each folder needs a{' '}
                <code className="rounded bg-muted px-1 py-0.5">SKILL.md</code> plus any scripts /
                reference files.
              </p>
            </div>

            <div
              className="flex cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border bg-muted/20 p-8 transition-colors hover:border-primary/40 hover:bg-muted/40"
              onClick={() => fileInputRef.current?.click()}
            >
              {zipFile ? (
                <>
                  <FileArchive className="h-8 w-8 text-primary" />
                  <div className="text-center">
                    <p className="text-sm font-medium">{zipFile.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(zipFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to select a ZIP file</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={handleZipSelect}
              />
            </div>

            {importedCount !== null && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                {importedCount} skill{importedCount > 1 ? 's' : ''} imported successfully
              </div>
            )}

            <Button
              className="w-full"
              onClick={handleZipImport}
              disabled={!zipFile || isImportingZip}
            >
              {isImportingZip ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Import from ZIP
            </Button>
          </TabsContent>

          {/* ── GitHub tab ────────────────────────────── */}
          <TabsContent value="github" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label>GitHub folder URL</Label>
              <p className="text-xs text-muted-foreground">
                Paste any GitHub URL pointing to a skill folder, e.g.:
              </p>
              <code className="block rounded bg-muted px-2 py-1.5 text-xs text-muted-foreground break-all">
                https://github.com/anthropics/skills/tree/main/skills/pptx
              </code>
            </div>

            <Input
              placeholder="https://github.com/owner/repo/tree/branch/path"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleGitHubImport()}
            />

            <Button
              className="w-full"
              onClick={handleGitHubImport}
              disabled={!githubUrl.trim() || isImportingGitHub}
            >
              {isImportingGitHub ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Github className="mr-2 h-4 w-4" />
              )}
              Import from GitHub
            </Button>

            <p className="text-xs text-muted-foreground">
              Works with public repositories. Private repos require a GitHub token configured in Settings.
            </p>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
