import { useState, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Prompt, usePrompts, useTags, usePromptVersions, useRestoreVersion, PromptVersion } from '@/hooks/useLocalPrompts';
import { Input } from '@/components/ui/input';
import { TAG_COLORS } from '@/constants';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
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
import { Save, Trash2, History, RotateCcw, Plus, X, Copy, Eye, EyeOff, FilePlus, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { PromptUsage } from './PromptUsage';
import { VersionChatExamples } from './VersionChatExamples';
import { AllVersionNotes } from './AllVersionNotes';
import { MarkdownPreview } from './MarkdownPreview';
import { SkillFiles } from './SkillFiles';

interface PromptEditorProps {
  prompt: Prompt | null;
  isNew: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export interface PromptEditorRef {
  triggerSave: () => void;
  startNewVersion: () => void;
  switchTab: (tabIndex: number) => void;
  toggleTagByIndex: (tagIndex: number) => void;
}

const tabValues = ['editor', 'usage', 'examples', 'notes', 'files'];

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(function PromptEditor(
  { prompt, isNew, onSave, onCancel },
  ref
) {
  const { createPrompt, updatePrompt, updateTags, deletePrompt, isCreating, isUpdating } = usePrompts();
  const { tags, createTag } = useTags();
  const { data: versions } = usePromptVersions(prompt?.id);
  const restoreVersion = useRestoreVersion();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [license, setLicense] = useState('');
  const [content, setContent] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [newTagName, setNewTagName] = useState('');
  const [activeTab, setActiveTab] = useState('editor');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [viewingVersion, setViewingVersion] = useState<PromptVersion | null>(null);
  const [isEditingNewVersion, setIsEditingNewVersion] = useState(false);

  useEffect(() => {
    if (prompt) {
      setTitle(prompt.title);
      setDescription(prompt.description || '');
      setLicense(prompt.license || '');
      setContent(prompt.active_version?.content || '');
      setEditingContent(prompt.active_version?.content || '');
      setSelectedTags(prompt.tags?.map((t) => t.id) || []);
      setSelectedVersionId(prompt.active_version?.id || null);
      setViewingVersion(null);
      setIsEditingNewVersion(false);
    } else {
      setTitle('');
      setDescription('');
      setLicense('');
      setContent('');
      setEditingContent('');
      setSelectedTags([]);
      setSelectedVersionId(null);
      setViewingVersion(null);
      setIsEditingNewVersion(false);
    }
  }, [prompt]);

  const isViewingOldVersion = viewingVersion !== null;

  const toggleTagById = async (tagId: string) => {
    const newTags = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];
    setSelectedTags(newTags);
    if (prompt && !isNew && !isEditingNewVersion) {
      await updateTags({ promptId: prompt.id, tagIds: newTags });
    }
  };

  useImperativeHandle(ref, () => ({
    triggerSave: () => {
      if (isNew) {
        handleCreateNewPrompt();
      } else if (isEditingNewVersion) {
        handleSaveNewVersion();
      }
    },
    startNewVersion: () => {
      if (!isNew && prompt && !isEditingNewVersion && !viewingVersion) {
        handleStartNewVersion();
      }
    },
    switchTab: (tabIndex: number) => {
      if (tabIndex >= 0 && tabIndex < tabValues.length) {
        if (!isNew || tabIndex === 0) {
          setActiveTab(tabValues[tabIndex]);
        }
      }
    },
    toggleTagByIndex: (tagIndex: number) => {
      if (tags[tagIndex] && !isViewingOldVersion) {
        toggleTagById(tags[tagIndex].id);
      }
    },
  }));

  const handleCreateNewPrompt = async () => {
    if (!title.trim() || !editingContent.trim()) return;
    await createPrompt({ title, description, license, content: editingContent, tagIds: selectedTags });
    onSave();
  };

  const handleSaveNewVersion = async () => {
    if (!prompt || !title.trim() || !editingContent.trim()) return;
    await updatePrompt({ promptId: prompt.id, title, description, license, content: editingContent, tagIds: selectedTags });
    setIsEditingNewVersion(false);
    setContent(editingContent);
    onSave();
  };

  // Save metadata (name/description/license) without creating a new version
  const handleSaveMetadata = async () => {
    if (!prompt || !title.trim()) return;
    await updatePrompt({ promptId: prompt.id, title, description, license, content, tagIds: selectedTags });
    onSave();
  };

  const handleStartNewVersion = () => {
    setEditingContent(content);
    setIsEditingNewVersion(true);
    setViewingVersion(null);
  };

  const handleCancelNewVersion = () => {
    setEditingContent(content);
    setIsEditingNewVersion(false);
  };

  const handleDelete = async () => {
    if (prompt) {
      await deletePrompt(prompt.id);
      onCancel();
    }
  };

  const getRandomUnusedColor = useCallback(() => {
    const usedColors = new Set(tags.map((t) => t.color));
    const availableColors = TAG_COLORS.filter((c) => !usedColors.has(c));
    if (availableColors.length > 0) {
      return availableColors[Math.floor(Math.random() * availableColors.length)];
    }
    return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  }, [tags]);

  const handleAddTag = async () => {
    if (!newTagName.trim()) return;
    const randomColor = getRandomUnusedColor();
    const tag = await createTag({ name: newTagName.trim(), color: randomColor });
    const newTags = [...selectedTags, tag.id];
    setSelectedTags(newTags);
    setNewTagName('');
    if (prompt && !isNew && !isEditingNewVersion) {
      await updateTags({ promptId: prompt.id, tagIds: newTags });
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!prompt) return;
    await restoreVersion.mutateAsync({ promptId: prompt.id, versionId });
    setSelectedVersionId(versionId);
    setViewingVersion(null);
    const restoredContent = versions?.find((v) => v.id === versionId)?.content || '';
    setContent(restoredContent);
    setEditingContent(restoredContent);
    setIsEditingNewVersion(false);
  };

  const handleViewVersion = (version: PromptVersion) => {
    if (viewingVersion?.id === version.id) {
      setViewingVersion(null);
    } else {
      setViewingVersion(version);
      setIsEditingNewVersion(false);
    }
  };

  const stopViewing = () => {
    setViewingVersion(null);
  };

  const toggleTag = async (tagId: string) => {
    const newTags = selectedTags.includes(tagId)
      ? selectedTags.filter((id) => id !== tagId)
      : [...selectedTags, tagId];
    setSelectedTags(newTags);
    if (prompt && !isNew && !isEditingNewVersion) {
      await updateTags({ promptId: prompt.id, tagIds: newTags });
    }
  };

  const copyToClipboard = async () => {
    const textToCopy = isEditingNewVersion ? editingContent : (viewingVersion?.content || content);
    if (!textToCopy) {
      toast.error('No content to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Copied to clipboard');
    } catch {
      toast.error('Copy failed');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSaving = isCreating || isUpdating;
  const activeVersion = versions?.find((v) => v.is_active);
  const previousVersion = versions?.find((v) => v.version_number === (activeVersion?.version_number || 1) - 1);
  const displayedContent = isViewingOldVersion ? viewingVersion.content : content;

  if (!isNew && !prompt) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select a skill or create a new one
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <span className="text-lg font-semibold text-foreground">
          {isNew ? 'New skill' : title || 'Untitled'}
        </span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={copyToClipboard} title="Copy instructions to clipboard">
            <Copy className="h-4 w-4" />
          </Button>
          {!isNew && prompt && (
            <>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete skill?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will permanently delete the skill and all its versions.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!isEditingNewVersion && !isViewingOldVersion && (
                <Button onClick={handleStartNewVersion}>
                  <FilePlus className="mr-2 h-4 w-4" />
                  New version
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={onCancel}>
            Close
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Main editor area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-border px-4">
              <TabsList className="h-10">
                <TabsTrigger value="editor">Skill content</TabsTrigger>
                {!isNew && prompt && (
                  <>
                    <TabsTrigger value="usage">Deployment notes</TabsTrigger>
                    <TabsTrigger value="examples">Test examples</TabsTrigger>
                    <TabsTrigger value="notes">Version notes</TabsTrigger>
                    <TabsTrigger value="files">Bundled files</TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            <TabsContent value="editor" className="flex-1 overflow-auto p-0 mt-0">
              <div className="flex h-full flex-col">

                {/* ── Metadata section (YAML frontmatter fields) ───────────── */}
                <div className="border-b border-border bg-muted/20 px-4 py-4 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    SKILL.md frontmatter
                  </p>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {/* Name */}
                    <div className="space-y-1">
                      <Label htmlFor="skill-name" className="text-xs">Name <span className="text-destructive">*</span></Label>
                      <Input
                        id="skill-name"
                        placeholder="my-skill-name"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isViewingOldVersion}
                        className="h-8 text-sm font-mono"
                      />
                    </div>

                    {/* License */}
                    <div className="space-y-1">
                      <Label htmlFor="skill-license" className="text-xs">License <span className="text-muted-foreground">(optional)</span></Label>
                      <Input
                        id="skill-license"
                        placeholder="MIT"
                        value={license}
                        onChange={(e) => setLicense(e.target.value)}
                        disabled={isViewingOldVersion}
                        className="h-8 text-sm"
                      />
                    </div>
                  </div>

                  {/* Description */}
                  <div className="space-y-1">
                    <Label htmlFor="skill-description" className="text-xs">Description <span className="text-destructive">*</span></Label>
                    <Textarea
                      id="skill-description"
                      placeholder="What does this skill do? (max 1024 chars)"
                      value={description}
                      onChange={(e) => setDescription(e.target.value.slice(0, 1024))}
                      disabled={isViewingOldVersion}
                      rows={2}
                      className="resize-none text-sm"
                    />
                    <p className="text-right text-xs text-muted-foreground">{description.length}/1024</p>
                  </div>

                  {/* Tags */}
                  <div className="space-y-1">
                    <Label className="text-xs">Tags</Label>
                    <div className="flex flex-wrap gap-2">
                      {tags.map((tag, index) => {
                        const isSelected = selectedTags.includes(tag.id);
                        return (
                          <Badge
                            key={tag.id}
                            variant="outline"
                            className={`cursor-pointer transition-all ${!isViewingOldVersion ? 'hover:opacity-80' : 'opacity-60'}`}
                            style={{
                              backgroundColor: isSelected ? tag.color : 'transparent',
                              borderColor: tag.color,
                              color: isSelected ? 'white' : tag.color,
                            }}
                            onClick={() => !isViewingOldVersion && toggleTag(tag.id)}
                          >
                            {index < 9 && <span className="mr-1 text-xs opacity-60">{index + 1}</span>}
                            {tag.name}
                            {isSelected && !isViewingOldVersion && <X className="ml-1 h-3 w-3" />}
                          </Badge>
                        );
                      })}
                      {!isViewingOldVersion && (
                        <div className="flex items-center gap-1">
                          <Input
                            id="tag-input"
                            placeholder="New tag..."
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                            className="h-6 w-28 text-xs"
                          />
                          <Button size="sm" variant="ghost" className="h-6 px-2" onClick={handleAddTag}>
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Save metadata button for existing skills (when not editing new version) */}
                  {!isNew && !isEditingNewVersion && !isViewingOldVersion && (
                    <div className="flex justify-end">
                      <Button size="sm" variant="secondary" onClick={handleSaveMetadata} disabled={isSaving || !title.trim()}>
                        <Save className="mr-1 h-3 w-3" />
                        Save metadata
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Instructions section ────────────────────────────────── */}
                <div className="flex flex-1 flex-col min-h-0 px-4 py-4 gap-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Instructions (SKILL.md body)
                    </p>
                    {isViewingOldVersion && (
                      <Button variant="outline" size="sm" onClick={stopViewing}>
                        <EyeOff className="mr-1 h-3 w-3" />
                        Back to active version
                      </Button>
                    )}
                    {isEditingNewVersion && (
                      <Button variant="outline" size="sm" onClick={handleCancelNewVersion}>
                        <X className="mr-1 h-3 w-3" />
                        Cancel new version
                      </Button>
                    )}
                  </div>

                  {isViewingOldVersion && (
                    <div className="flex items-center gap-2 rounded-md bg-muted border border-border px-3 py-2 text-xs text-muted-foreground">
                      <Eye className="h-3 w-3 shrink-0" />
                      Viewing version {viewingVersion?.version_number} — read-only
                    </div>
                  )}
                  {isEditingNewVersion && (
                    <div className="flex items-center gap-2 rounded-md bg-muted border border-border px-3 py-2 text-xs text-muted-foreground">
                      <Pencil className="h-3 w-3 shrink-0" />
                      Editing a new version — saving will increment the version number
                    </div>
                  )}

                  <div className="flex-1 min-h-[200px]">
                    {isNew || isEditingNewVersion ? (
                      <Textarea
                        placeholder="Write your skill instructions here..."
                        value={editingContent}
                        onChange={(e) => setEditingContent(e.target.value)}
                        className="h-full min-h-[200px] resize-none font-mono text-sm"
                      />
                    ) : (
                      <div className="h-full min-h-[200px] rounded-md border border-input bg-muted/30">
                        <MarkdownPreview content={displayedContent} className="h-full" />
                      </div>
                    )}
                  </div>

                  {/* Save buttons */}
                  {(isNew || isEditingNewVersion) && (
                    <div className="flex justify-end border-t border-border pt-3">
                      {isNew ? (
                        <Button
                          onClick={handleCreateNewPrompt}
                          disabled={isSaving || !title.trim() || !editingContent.trim()}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {isSaving ? 'Saving...' : 'Create skill'}
                        </Button>
                      ) : (
                        <Button
                          onClick={handleSaveNewVersion}
                          disabled={isSaving || !title.trim() || !editingContent.trim()}
                        >
                          <Save className="mr-2 h-4 w-4" />
                          {isSaving ? 'Saving...' : 'Save new version'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>

              </div>
            </TabsContent>

            {!isNew && prompt && (
              <>
                <TabsContent value="usage" className="flex-1 overflow-hidden p-0 mt-0">
                  <PromptUsage promptId={prompt.id} />
                </TabsContent>

                <TabsContent value="examples" className="flex-1 overflow-hidden p-0 mt-0">
                  {activeVersion && (
                    <VersionChatExamples
                      versionId={activeVersion.id}
                      previousVersionId={previousVersion?.id}
                    />
                  )}
                </TabsContent>

                <TabsContent value="notes" className="flex-1 overflow-hidden p-0 mt-0">
                  {activeVersion && (
                    <AllVersionNotes promptId={prompt.id} activeVersionId={activeVersion.id} />
                  )}
                </TabsContent>

                <TabsContent value="files" className="flex-1 overflow-hidden p-0 mt-0">
                  <SkillFiles promptId={prompt.id} />
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>

        {/* Version history sidebar */}
        {!isNew && versions && versions.length > 0 && (
          <div className="w-64 border-l border-border bg-muted/30">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Version history</span>
            </div>
            <ScrollArea className="h-[calc(100%-49px)]">
              <div className="divide-y divide-border">
                {versions.map((version) => (
                  <div
                    key={version.id}
                    className={`p-3 transition-colors ${
                      version.is_active
                        ? 'bg-primary/10 border-l-4 border-l-primary'
                        : viewingVersion?.id === version.id
                        ? 'bg-amber-100/50 dark:bg-amber-900/20 border-l-4 border-l-amber-500'
                        : 'border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`text-sm ${version.is_active ? 'font-semibold' : 'font-medium'}`}>
                        v{version.version_number}
                        {version.is_active && (
                          <Badge className="ml-2 text-xs bg-primary text-primary-foreground">Active</Badge>
                        )}
                        {viewingVersion?.id === version.id && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-700 dark:text-amber-400">
                            Viewing
                          </Badge>
                        )}
                      </span>
                    </div>
                    <div className={`text-xs ${version.is_active ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                      {formatDate(version.created_at)}
                    </div>
                    <div className={`mt-1 line-clamp-2 text-xs ${version.is_active ? 'text-foreground/60' : 'text-muted-foreground'}`}>
                      {version.content}
                    </div>
                    {!version.is_active && (
                      <div className="mt-2 flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleViewVersion(version)}
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          {viewingVersion?.id === version.id ? 'Stop' : 'View'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleRestoreVersion(version.id)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Restore
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
});
