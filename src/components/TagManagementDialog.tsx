import { useState, useEffect, useCallback } from 'react';
import { useTags, Tag } from '@/hooks/useLocalSkills';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Check, X, Plus } from 'lucide-react';
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
import { TAG_COLORS } from '@/constants';

interface TagManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getRandomUnusedColor(usedColors: string[]): string {
  const availableColors = TAG_COLORS.filter(color => !usedColors.includes(color));
  if (availableColors.length === 0) {
    return TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
  }
  return availableColors[Math.floor(Math.random() * availableColors.length)];
}

export function TagManagementDialog({ open, onOpenChange }: TagManagementDialogProps) {
  const { tags, createTag, updateTag, deleteTag } = useTags();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(() => getRandomUnusedColor([]));
  const [colorPickerOpen, setColorPickerOpen] = useState<string | null>(null);
  const [customColorInput, setCustomColorInput] = useState('');

  const pickRandomColor = useCallback(() => {
    const usedColors = tags.map(t => t.color);
    return getRandomUnusedColor(usedColors);
  }, [tags]);

  useEffect(() => {
    if (open) {
      setNewTagColor(pickRandomColor());
    }
  }, [open, pickRandomColor]);

  const handleStartEdit = (tag: Tag) => {
    setEditingId(tag.id);
    setEditingName(tag.name);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;
    await updateTag({ id: editingId, name: editingName.trim() });
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleColorChange = async (tagId: string, color: string) => {
    await updateTag({ id: tagId, color });
    setColorPickerOpen(null);
    setCustomColorInput('');
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await createTag({ name: newTagName.trim(), color: newTagColor });
    setNewTagName('');
    setTimeout(() => {
      const usedColors = [...tags.map(t => t.color), newTagColor];
      setNewTagColor(getRandomUnusedColor(usedColors));
    }, 100);
  };

  const handleDelete = async (tagId: string) => {
    await deleteTag(tagId);
  };

  const handleCustomColorApply = (tagId: string) => {
    const hexRegex = /^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;
    if (hexRegex.test(customColorInput)) {
      const color = customColorInput.startsWith('#') ? customColorInput : `#${customColorInput}`;
      handleColorChange(tagId, color);
    }
  };

  const handleNewTagCustomColor = () => {
    const hexRegex = /^#?([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;
    if (hexRegex.test(customColorInput)) {
      const color = customColorInput.startsWith('#') ? customColorInput : `#${customColorInput}`;
      setNewTagColor(color);
      setCustomColorInput('');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Tag management</DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 items-center p-3 bg-muted/50 rounded-lg">
          <Input
            placeholder="New tag name..."
            value={newTagName}
            onChange={(e) => setNewTagName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()}
            className="flex-1"
          />
          <Popover>
            <PopoverTrigger asChild>
              <button
                className="w-7 h-7 rounded-full border-2 border-border hover:scale-110 transition-transform shrink-0"
                style={{ backgroundColor: newTagColor }}
                title="Click to choose color"
              />
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <div className="space-y-3">
                <div className="flex gap-1.5 flex-wrap w-36">
                  {TAG_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewTagColor(color)}
                      className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                        newTagColor === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
                <div className="flex gap-1.5 items-center pt-2 border-t border-border">
                  <Input
                    placeholder="#hexcode"
                    value={customColorInput}
                    onChange={(e) => setCustomColorInput(e.target.value)}
                    className="h-7 text-xs flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleNewTagCustomColor()}
                  />
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={handleNewTagCustomColor}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>
          <Button size="sm" onClick={handleCreateTag} disabled={!newTagName.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="max-h-[50vh]">
          <div className="space-y-2">
            {tags.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                No tags created yet.
              </p>
            ) : (
              tags.map((tag, index) => (
                <div
                  key={tag.id}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background"
                >
                  <span className="text-xs text-muted-foreground w-4 text-center">
                    {index < 9 ? index + 1 : ''}
                  </span>

                  <Popover 
                    open={colorPickerOpen === tag.id} 
                    onOpenChange={(isOpen) => {
                      setColorPickerOpen(isOpen ? tag.id : null);
                      if (!isOpen) setCustomColorInput('');
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        className="w-6 h-6 rounded-full border-2 border-border hover:scale-110 transition-transform"
                        style={{ backgroundColor: tag.color }}
                      />
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-3" align="start">
                      <div className="space-y-3">
                        <div className="flex gap-1.5 flex-wrap w-36">
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => handleColorChange(tag.id, color)}
                              className={`w-6 h-6 rounded-full transition-transform hover:scale-110 ${
                                tag.color === color ? 'ring-2 ring-offset-2 ring-primary' : ''
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                        <div className="flex gap-1.5 items-center pt-2 border-t border-border">
                          <Input
                            placeholder="#hexcode"
                            value={customColorInput}
                            onChange={(e) => setCustomColorInput(e.target.value)}
                            className="h-7 text-xs flex-1"
                            onKeyDown={(e) => e.key === 'Enter' && handleCustomColorApply(tag.id)}
                          />
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-7 px-2" 
                            onClick={() => handleCustomColorApply(tag.id)}
                          >
                            <Check className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {editingId === tag.id ? (
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit();
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 h-8"
                      autoFocus
                    />
                  ) : (
                    <span
                      className="flex-1 text-sm cursor-pointer hover:text-primary"
                      onClick={() => handleStartEdit(tag)}
                    >
                      {tag.name}
                    </span>
                  )}

                  {editingId === tag.id ? (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSaveEdit}>
                        <Check className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleCancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete tag?</AlertDialogTitle>
                          <AlertDialogDescription>
                            The tag "{tag.name}" will be removed from all skills.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(tag.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        <p className="text-xs text-muted-foreground">
          Tip: Use Alt+1-9 to quickly toggle tags on a skill.
        </p>
      </DialogContent>
    </Dialog>
  );
}
