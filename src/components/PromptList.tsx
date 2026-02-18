import { useState, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { usePrompts, useTags, Prompt } from '@/hooks/useLocalPrompts';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Search, ArrowUpDown, Clock, SortAsc, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface PromptListProps {
  selectedPromptId: string | null;
  onSelectPrompt: (prompt: Prompt) => void;
  onNewPrompt: () => void;
}

export interface PromptListRef {
  focusSearch: () => void;
  navigateUp: () => void;
  navigateDown: () => void;
  getFilteredPrompts: () => Prompt[];
}

type SortOption = 'updated' | 'alphabetical';

export const PromptList = forwardRef<PromptListRef, PromptListProps>(function PromptList(
  { selectedPromptId, onSelectPrompt, onNewPrompt },
  ref
) {
  const { prompts, isLoading } = usePrompts();
  const { tags } = useTags();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const copyPromptToClipboard = async (prompt: Prompt, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const content = prompt.active_version?.content || '';
    if (!content) {
      toast.error('Geen content om te kopiëren');
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      toast.success(`"${prompt.title}" gekopieerd naar clipboard`);
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    },
    navigateUp: () => {
      const currentIndex = filteredPrompts.findIndex((p) => p.id === selectedPromptId);
      if (currentIndex > 0) {
        onSelectPrompt(filteredPrompts[currentIndex - 1]);
      } else if (currentIndex === -1 && filteredPrompts.length > 0) {
        onSelectPrompt(filteredPrompts[filteredPrompts.length - 1]);
      }
    },
    navigateDown: () => {
      const currentIndex = filteredPrompts.findIndex((p) => p.id === selectedPromptId);
      if (currentIndex < filteredPrompts.length - 1) {
        onSelectPrompt(filteredPrompts[currentIndex + 1]);
      } else if (currentIndex === -1 && filteredPrompts.length > 0) {
        onSelectPrompt(filteredPrompts[0]);
      }
    },
    getFilteredPrompts: () => filteredPrompts,
  }));

  const filteredPrompts = useMemo(() => {
    let filtered = prompts;

    // Filter by search
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.title.toLowerCase().includes(searchLower) ||
          p.active_version?.content.toLowerCase().includes(searchLower)
      );
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter((p) =>
        selectedTags.every((tagId) => p.tags?.some((t) => t.id === tagId))
      );
    }

    // Sort
    if (sortBy === 'alphabetical') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }

    return filtered;
  }, [prompts, search, sortBy, selectedTags]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Vandaag';
    if (diffDays === 1) return 'Gisteren';
    if (diffDays < 7) return `${diffDays} dagen geleden`;
    return date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });
  };

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        <h1 className="text-lg font-semibold">Prompts</h1>
        <Button size="sm" onClick={onNewPrompt}>
          <Plus className="mr-1 h-4 w-4" />
          Nieuw
        </Button>
      </div>

      {/* Search & Sort */}
      <div className="space-y-3 border-b border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Zoeken... (druk /)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs">
                <ArrowUpDown className="mr-1 h-3 w-3" />
                {sortBy === 'updated' ? 'Laatst gewijzigd' : 'Alfabetisch'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setSortBy('updated')}>
                <Clock className="mr-2 h-4 w-4" />
                Laatst gewijzigd
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('alphabetical')}>
                <SortAsc className="mr-2 h-4 w-4" />
                Alfabetisch
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tag filters */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tag) => (
              <Badge
                key={tag.id}
                variant={selectedTags.includes(tag.id) ? 'default' : 'outline'}
                className="cursor-pointer text-xs"
                onClick={() => toggleTag(tag.id)}
              >
                {tag.name}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Prompt list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">Laden...</div>
        ) : filteredPrompts.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {prompts.length === 0 ? 'Nog geen prompts' : 'Geen resultaten'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredPrompts.map((prompt) => (
              <div
                key={prompt.id}
                className={cn(
                  'group relative flex items-start gap-2 p-4 transition-colors hover:bg-muted/50',
                  selectedPromptId === prompt.id && 'bg-muted'
                )}
              >
                <button
                  onClick={() => onSelectPrompt(prompt)}
                  className="flex-1 text-left"
                >
                  <div className="mb-1 font-medium">{prompt.title}</div>
                  {prompt.active_version && (
                    <div className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                      {prompt.active_version.content}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(prompt.updated_at)}</span>
                    {prompt.tags && prompt.tags.length > 0 && (
                      <div className="flex gap-1">
                        {prompt.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag.id} variant="secondary" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                        {prompt.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{prompt.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                  onClick={(e) => copyPromptToClipboard(prompt, e)}
                  title="Kopieer naar clipboard"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
});
