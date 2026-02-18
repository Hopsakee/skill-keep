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

const tabValues = ['editor', 'usage', 'examples', 'notes'];

export const PromptEditor = forwardRef<PromptEditorRef, PromptEditorProps>(function PromptEditor(
  { prompt, isNew, onSave, onCancel },
  ref
) {
  const { createPrompt, updatePrompt, updateTags, deletePrompt, isCreating, isUpdating } = usePrompts();
  const { tags, createTag } = useTags();
  const { data: versions } = usePromptVersions(prompt?.id);
  const restoreVersion = useRestoreVersion();

  const [title, setTitle] = useState('');
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
      setContent(prompt.active_version?.content || '');
      setEditingContent(prompt.active_version?.content || '');
      setSelectedTags(prompt.tags?.map((t) => t.id) || []);
      setSelectedVersionId(prompt.active_version?.id || null);
      setViewingVersion(null);
      setIsEditingNewVersion(false);
    } else {
      setTitle('');
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
    
    // Save tags immediately for existing prompts (not when creating new or editing version)
    if (prompt && !isNew && !isEditingNewVersion) {
      await updateTags({ promptId: prompt.id, tagIds: newTags });
    }
  };

  // Expose methods via ref
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
        // Only allow tabs 1-3 for existing prompts
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
    await createPrompt({ title, content: editingContent, tagIds: selectedTags });
    onSave();
  };

  const handleSaveNewVersion = async () => {
    if (!prompt || !title.trim() || !editingContent.trim()) return;
    await updatePrompt({ promptId: prompt.id, title, content: editingContent, tagIds: selectedTags });
    setIsEditingNewVersion(false);
    setContent(editingContent);
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
    
    // Save tags immediately for existing prompts
    if (prompt && !isNew && !isEditingNewVersion) {
      await updateTags({ promptId: prompt.id, tagIds: newTags });
    }
  };

  const handleRestoreVersion = async (versionId: string) => {
    if (!prompt) return;
    await restoreVersion.mutateAsync({ promptId: prompt.id, versionId });
    setSelectedVersionId(versionId);
    setViewingVersion(null);
    const restoredContent = versions?.find(v => v.id === versionId)?.content || '';
    setContent(restoredContent);
    setEditingContent(restoredContent);
    setIsEditingNewVersion(false);
  };

  const handleViewVersion = (version: PromptVersion) => {
    if (viewingVersion?.id === version.id) {
      // Stop viewing - go back to active version
      setViewingVersion(null);
    } else {
      // View this version (read-only)
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
    
    // Save tags immediately for existing prompts (not when creating new or editing version)
    if (prompt && !isNew && !isEditingNewVersion) {
      await updateTags({ promptId: prompt.id, tagIds: newTags });
    }
  };

  const copyToClipboard = async () => {
    const textToCopy = isEditingNewVersion ? editingContent : (viewingVersion?.content || content);
    if (!textToCopy) {
      toast.error('Geen content om te kopiëren');
      return;
    }
    try {
      await navigator.clipboard.writeText(textToCopy);
      toast.success('Prompt gekopieerd naar clipboard');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('nl-NL', {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const isSaving = isCreating || isUpdating;
  const activeVersion = versions?.find((v) => v.is_active);
  const previousVersion = versions?.find((v) => v.version_number === (activeVersion?.version_number || 1) - 1);
  // isViewingOldVersion is defined earlier
  const displayedContent = isViewingOldVersion ? viewingVersion.content : content;

  if (!isNew && !prompt) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Selecteer een prompt of maak een nieuwe aan
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <Input
          placeholder="Titel..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="max-w-md border-0 bg-transparent text-lg font-semibold focus-visible:ring-0"
        />
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={copyToClipboard} title="Kopieer naar clipboard (Ctrl+Shift+K)">
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
                    <AlertDialogTitle>Prompt verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Dit verwijdert de prompt en alle versies permanent.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Verwijderen
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              {!isEditingNewVersion && !isViewingOldVersion && (
                <Button onClick={handleStartNewVersion}>
                  <FilePlus className="mr-2 h-4 w-4" />
                  Nieuwe versie maken
                </Button>
              )}
            </>
          )}
          <Button variant="outline" onClick={onCancel}>
            Sluiten
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
                <TabsTrigger value="editor">Prompt</TabsTrigger>
                {!isNew && prompt && (
                  <>
                    <TabsTrigger value="usage">Toelichting gebruik</TabsTrigger>
                    <TabsTrigger value="examples">Chat-voorbeelden versie</TabsTrigger>
                    <TabsTrigger value="notes">Notities versies</TabsTrigger>
                  </>
                )}
              </TabsList>
            </div>

            <TabsContent value="editor" className="flex-1 overflow-hidden p-0 mt-0">
              <div className="flex h-full flex-col p-4">
                {/* Viewing old version banner */}
                {isViewingOldVersion && (
                  <div className="mb-4 flex items-center justify-between rounded-md bg-amber-100 p-3 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200">
                    <span className="text-sm font-medium">
                      Je bekijkt versie {viewingVersion?.version_number} (alleen lezen)
                    </span>
                    <Button variant="outline" size="sm" onClick={stopViewing}>
                      <EyeOff className="mr-1 h-3 w-3" />
                      Terug naar actieve versie
                    </Button>
                  </div>
                )}

                {/* Editing new version banner */}
                {isEditingNewVersion && (
                  <div className="mb-4 flex items-center justify-between rounded-md bg-blue-100 p-3 text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
                    <span className="text-sm font-medium">
                      Je bewerkt een nieuwe versie
                    </span>
                    <Button variant="outline" size="sm" onClick={handleCancelNewVersion}>
                      <X className="mr-1 h-3 w-3" />
                      Annuleren
                    </Button>
                  </div>
                )}

                {/* Tags */}
                <div className="mb-4 space-y-2">
                  <Label>Tags <span className="text-xs text-muted-foreground ml-1">(T om te focussen, Alt+1-9 om te togglen)</span></Label>
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
                          {index < 9 && (
                            <span className="mr-1 text-xs opacity-60">{index + 1}</span>
                          )}
                          {tag.name}
                          {isSelected && !isViewingOldVersion && (
                            <X className="ml-1 h-3 w-3" />
                          )}
                        </Badge>
                      );
                    })}
                    {!isViewingOldVersion && (
                      <div className="flex items-center gap-1">
                        <Input
                          id="tag-input"
                          placeholder="Nieuwe tag..."
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

                {/* Content area */}
                <div className="flex-1 min-h-0">
                  {isNew || isEditingNewVersion ? (
                    <Textarea
                      placeholder="Schrijf je prompt hier..."
                      value={editingContent}
                      onChange={(e) => setEditingContent(e.target.value)}
                      className="h-full min-h-[300px] resize-none font-mono text-sm"
                    />
                  ) : (
                    <div className="h-full min-h-[300px] rounded-md border border-input bg-muted/30">
                      <MarkdownPreview content={displayedContent} className="h-full" />
                    </div>
                  )}
                </div>

                {/* Save button at the bottom for new prompts or new versions */}
                {(isNew || isEditingNewVersion) && (
                  <div className="mt-4 flex justify-end border-t border-border pt-4">
                    {isNew ? (
                      <Button 
                        onClick={handleCreateNewPrompt} 
                        disabled={isSaving || !title.trim() || !editingContent.trim()}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? 'Opslaan...' : 'Opslaan'}
                      </Button>
                    ) : (
                      <Button 
                        onClick={handleSaveNewVersion} 
                        disabled={isSaving || !title.trim() || !editingContent.trim()}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isSaving ? 'Opslaan...' : 'Nieuwe versie opslaan'}
                      </Button>
                    )}
                  </div>
                )}
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
              </>
            )}
          </Tabs>
        </div>

        {/* Version history sidebar */}
        {!isNew && versions && versions.length > 0 && (
          <div className="w-64 border-l border-border bg-muted/30">
            <div className="flex items-center gap-2 border-b border-border p-3">
              <History className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Versiegeschiedenis</span>
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
                          <Badge className="ml-2 text-xs bg-primary text-primary-foreground">
                            Actief
                          </Badge>
                        )}
                        {viewingVersion?.id === version.id && (
                          <Badge variant="outline" className="ml-2 text-xs border-amber-500 text-amber-700 dark:text-amber-400">
                            Bekijken
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
                          {viewingVersion?.id === version.id ? 'Stop' : 'Bekijk'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleRestoreVersion(version.id)}
                        >
                          <RotateCcw className="mr-1 h-3 w-3" />
                          Herstel
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
