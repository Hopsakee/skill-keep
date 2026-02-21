import { useState, useMemo, forwardRef, useImperativeHandle, useRef } from 'react';
import { useSkills, useTags, Skill } from '@/hooks/useLocalSkills';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, ArrowUpDown, Clock, SortAsc, Copy, Download, X, CheckSquare, FolderDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { downloadSkillsAsZip } from '@/utils/skillExport';
import { SkillImportDialog } from '@/components/SkillImportDialog';

interface SkillListProps {
  selectedSkillId: string | null;
  onSelectSkill: (skill: Skill) => void;
  onNewSkill: () => void;
  onImportedSkill?: (skillId: string) => void;
}

export interface SkillListRef {
  focusSearch: () => void;
  navigateUp: () => void;
  navigateDown: () => void;
  getFilteredSkills: () => Skill[];
}

type SortOption = 'updated' | 'alphabetical';

export const SkillList = forwardRef<SkillListRef, SkillListProps>(function SkillList(
  { selectedSkillId, onSelectSkill, onNewSkill, onImportedSkill },
  ref
) {
  const { skills, isLoading } = useSkills();
  const { tags } = useTags();
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('updated');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const copySkillToClipboard = async (skill: Skill, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const content = skill.active_version?.content || '';
    if (!content) {
      toast.error('No content to copy');
      return;
    }
    try {
      await navigator.clipboard.writeText(content);
      toast.success(`"${skill.title}" copied to clipboard`);
    } catch {
      toast.error('Copy failed');
    }
  };

  useImperativeHandle(ref, () => ({
    focusSearch: () => {
      searchInputRef.current?.focus();
    },
    navigateUp: () => {
      const currentIndex = filteredSkills.findIndex((s) => s.id === selectedSkillId);
      if (currentIndex > 0) {
        onSelectSkill(filteredSkills[currentIndex - 1]);
      } else if (currentIndex === -1 && filteredSkills.length > 0) {
        onSelectSkill(filteredSkills[filteredSkills.length - 1]);
      }
    },
    navigateDown: () => {
      const currentIndex = filteredSkills.findIndex((s) => s.id === selectedSkillId);
      if (currentIndex < filteredSkills.length - 1) {
        onSelectSkill(filteredSkills[currentIndex + 1]);
      } else if (currentIndex === -1 && filteredSkills.length > 0) {
        onSelectSkill(filteredSkills[0]);
      }
    },
    getFilteredSkills: () => filteredSkills,
  }));

  const filteredSkills = useMemo(() => {
    let filtered = skills;

    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(searchLower) ||
          s.active_version?.content.toLowerCase().includes(searchLower)
      );
    }

    if (selectedTags.length > 0) {
      filtered = filtered.filter((s) =>
        selectedTags.every((tagId) => s.tags?.some((t) => t.id === tagId))
      );
    }

    if (sortBy === 'alphabetical') {
      filtered = [...filtered].sort((a, b) => a.title.localeCompare(b.title));
    } else {
      filtered = [...filtered].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    }

    return filtered;
  }, [skills, search, sortBy, selectedTags]);

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (checkedIds.size === filteredSkills.length) {
      setCheckedIds(new Set());
    } else {
      setCheckedIds(new Set(filteredSkills.map((s) => s.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setCheckedIds(new Set());
  };

  const handleExportZip = async () => {
    if (checkedIds.size === 0) return;
    setIsExporting(true);
    try {
      await downloadSkillsAsZip(Array.from(checkedIds));
      toast.success(`${checkedIds.size} skill${checkedIds.size > 1 ? 's' : ''} exported as ZIP`);
      exitSelectMode();
    } catch (e) {
      toast.error('Export failed');
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const allChecked = filteredSkills.length > 0 && checkedIds.size === filteredSkills.length;

  return (
    <div className="flex h-full flex-col border-r border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border p-4">
        {selectMode ? (
          <>
            <span className="text-sm font-medium text-muted-foreground">
              {checkedIds.size} selected
            </span>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleSelectAll}
                title={allChecked ? 'Deselect all' : 'Select all'}
              >
                <CheckSquare className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                onClick={handleExportZip}
                disabled={checkedIds.size === 0 || isExporting}
              >
                <Download className="mr-1 h-4 w-4" />
                Download ZIP
              </Button>
              <Button size="sm" variant="ghost" onClick={exitSelectMode}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-lg font-semibold">Skills</h1>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowImport(true)}
                title="Import skill"
              >
                <FolderDown className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectMode(true)}
                title="Select skills to export"
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={onNewSkill}>
                <Plus className="mr-1 h-4 w-4" />
                New
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Search & Sort */}
      <div className="space-y-3 border-b border-border p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            placeholder="Search... (press /)"
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
                {sortBy === 'updated' ? 'Last modified' : 'Alphabetical'}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onClick={() => setSortBy('updated')}>
                <Clock className="mr-2 h-4 w-4" />
                Last modified
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy('alphabetical')}>
                <SortAsc className="mr-2 h-4 w-4" />
                Alphabetical
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

      {/* Skill list */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">Loading...</div>
        ) : filteredSkills.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            {skills.length === 0 ? 'No skills yet' : 'No results'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredSkills.map((skill) => (
              <div
                key={skill.id}
                className={cn(
                  'group relative flex items-start gap-2 p-4 transition-colors hover:bg-muted/50',
                  !selectMode && selectedSkillId === skill.id && 'bg-muted',
                  selectMode && checkedIds.has(skill.id) && 'bg-muted/60'
                )}
              >
                {selectMode && (
                  <div className="flex shrink-0 items-center pt-0.5">
                    <Checkbox
                      checked={checkedIds.has(skill.id)}
                      onCheckedChange={() => toggleCheck(skill.id)}
                      aria-label={`Select ${skill.title}`}
                    />
                  </div>
                )}
                <button
                  onClick={() => {
                    if (selectMode) {
                      toggleCheck(skill.id);
                    } else {
                      onSelectSkill(skill);
                    }
                  }}
                  className="flex-1 text-left"
                >
                  <div className="mb-1 font-medium">{skill.title}</div>
                  {skill.active_version && (
                    <div className="mb-2 line-clamp-2 text-sm text-muted-foreground">
                      {skill.active_version.content}
                    </div>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDate(skill.updated_at)}</span>
                    {skill.tags && skill.tags.length > 0 && (
                      <div className="flex gap-1">
                        {skill.tags.slice(0, 2).map((tag) => (
                          <Badge key={tag.id} variant="secondary" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                        {skill.tags.length > 2 && (
                          <Badge variant="secondary" className="text-xs">
                            +{skill.tags.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </button>
                {!selectMode && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => copySkillToClipboard(skill, e)}
                    title="Copy to clipboard"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Select mode hint */}
      {selectMode && (
        <div className="border-t border-border px-4 py-2 text-center text-xs text-muted-foreground">
          Click skills to select • ZIP preserves SKILL.md + bundled files
        </div>
      )}

      <SkillImportDialog
        open={showImport}
        onOpenChange={setShowImport}
        onImported={(id) => {
          const imported = skills.find((s) => s.id === id);
          if (imported) onSelectSkill(imported);
          if (onImportedSkill) onImportedSkill(id);
        }}
      />
    </div>
  );
});
