import { useState, useEffect } from 'react';
import { useChatExamples, useVersionChatExamples } from '@/hooks/useLocalSkills';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Plus, Trash2, Copy, ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export interface ChatExample {
  userPrompt: string;
  assistantResponse: string;
}

interface VersionChatExamplesProps {
  versionId: string;
  previousVersionId?: string;
}

export function VersionChatExamples({ versionId, previousVersionId }: VersionChatExamplesProps) {
  const { chatExample, isLoading, upsertChatExample } = useChatExamples(versionId);
  const { data: previousChatExample } = useVersionChatExamples(previousVersionId);
  const [examples, setExamples] = useState<ChatExample[]>([]);
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);
  const [showPrevious, setShowPrevious] = useState(false);

  useEffect(() => {
    if (chatExample?.messages) {
      const msgs = chatExample.messages;
      if (msgs.length > 0 && 'userPrompt' in msgs[0]) {
        setExamples(msgs as unknown as ChatExample[]);
      } else {
        const converted: ChatExample[] = [];
        for (let i = 0; i < msgs.length; i++) {
          if (msgs[i].role === 'user') {
            converted.push({
              userPrompt: msgs[i].content,
              assistantResponse: msgs[i + 1]?.role === 'assistant' ? msgs[i + 1].content : '',
            });
            if (msgs[i + 1]?.role === 'assistant') i++;
          }
        }
        setExamples(converted);
      }
    } else {
      setExamples([]);
    }
  }, [chatExample]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertChatExample({ 
        versionId, 
        messages: examples as unknown as { role: 'user' | 'assistant'; content: string }[] 
      });
      toast.success('Chat examples saved');
    } finally {
      setIsSaving(false);
    }
  };

  const addExample = () => {
    setExamples((prev) => [...prev, { userPrompt: '', assistantResponse: '' }]);
    setExpandedIndexes((prev) => new Set([...prev, examples.length]));
  };

  const updateExample = (index: number, field: 'userPrompt' | 'assistantResponse', value: string) => {
    setExamples((prev) =>
      prev.map((ex, i) => (i === index ? { ...ex, [field]: value } : ex))
    );
  };

  const removeExample = (index: number) => {
    setExamples((prev) => prev.filter((_, i) => i !== index));
    setExpandedIndexes((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const toggleExpand = (index: number) => {
    setExpandedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIndexes(new Set(examples.map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedIndexes(new Set());
  };

  const copyUserPrompts = () => {
    const previousExamples = getPreviousExamples();
    const userPrompts = previousExamples.map((ex) => ex.userPrompt).join('\n\n---\n\n');
    if (userPrompts) {
      navigator.clipboard.writeText(userPrompts);
      toast.success('User prompts copied to clipboard');
    }
  };

  const importUserPrompts = () => {
    const previousExamples = getPreviousExamples();
    if (previousExamples.length === 0) return;
    const newExamples: ChatExample[] = previousExamples.map((ex) => ({
      userPrompt: ex.userPrompt,
      assistantResponse: '',
    }));
    const startIndex = examples.length;
    setExamples((prev) => [...prev, ...newExamples]);
    setExpandedIndexes((prev) => {
      const next = new Set(prev);
      newExamples.forEach((_, i) => next.add(startIndex + i));
      return next;
    });
    toast.success('User prompts imported');
  };

  const getPreviousExamples = (): ChatExample[] => {
    if (!previousChatExample?.messages) return [];
    const msgs = previousChatExample.messages;
    if (msgs.length > 0 && 'userPrompt' in msgs[0]) {
      return msgs as unknown as ChatExample[];
    }
    const converted: ChatExample[] = [];
    for (let i = 0; i < msgs.length; i++) {
      if (msgs[i].role === 'user') {
        converted.push({
          userPrompt: msgs[i].content,
          assistantResponse: msgs[i + 1]?.role === 'assistant' ? msgs[i + 1].content : '',
        });
        if (msgs[i + 1]?.role === 'assistant') i++;
      }
    }
    return converted;
  };

  const getPreviewLines = (text: string, lines: number = 2): string => {
    const allLines = text.split('\n');
    if (allLines.length <= lines) return text;
    return allLines.slice(0, lines).join('\n') + '...';
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  const previousExamples = getPreviousExamples();

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <p className="text-sm text-muted-foreground">
          Add chat examples (user prompt + assistant response). User prompts from previous versions can be easily reused.
        </p>
      </div>

      {previousVersionId && previousExamples.length > 0 && (
        <Collapsible open={showPrevious} onOpenChange={setShowPrevious}>
          <div className="border-b border-border bg-muted/30">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between rounded-none px-4 py-3">
                <span className="text-sm font-medium">
                  User prompts from previous version ({previousExamples.length})
                </span>
                {showPrevious ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 px-4 pb-4">
                {previousExamples.map((ex, index) => (
                  <div
                    key={index}
                    className="rounded-md border border-border bg-background p-3"
                  >
                    <p className="line-clamp-3 text-sm whitespace-pre-wrap">{ex.userPrompt}</p>
                  </div>
                ))}
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" onClick={copyUserPrompts}>
                    <Copy className="mr-1 h-3 w-3" />
                    Copy
                  </Button>
                  <Button variant="outline" size="sm" onClick={importUserPrompts}>
                    <Plus className="mr-1 h-3 w-3" />
                    Import
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </div>
        </Collapsible>
      )}

      {examples.length > 0 && (
        <div className="flex gap-2 border-b border-border px-4 py-2">
          <Button variant="ghost" size="sm" onClick={expandAll}>
            <ChevronsUpDown className="mr-1 h-3 w-3" />
            Expand all
          </Button>
          <Button variant="ghost" size="sm" onClick={collapseAll}>
            <ChevronsUpDown className="mr-1 h-3 w-3" />
            Collapse all
          </Button>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {examples.map((example, index) => {
            const isExpanded = expandedIndexes.has(index);
            return (
              <div
                key={index}
                className="rounded-lg border border-border overflow-hidden"
              >
                <div
                  className="flex items-start gap-2 p-3 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleExpand(index)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-muted-foreground">
                        Example {index + 1}
                      </span>
                    </div>
                    <p className="text-sm whitespace-pre-wrap text-foreground">
                      {getPreviewLines(example.userPrompt || '(empty)', 2)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeExample(index);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                    {isExpanded ? (
                      <ChevronUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="p-4 space-y-4 border-t border-border">
                    <div>
                      <label className="text-sm font-medium mb-2 block">User Prompt</label>
                      <Textarea
                        placeholder="User prompt..."
                        value={example.userPrompt}
                        onChange={(e) => updateExample(index, 'userPrompt', e.target.value)}
                        className="min-h-[100px] resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Assistant Response</label>
                      <Textarea
                        placeholder="Assistant response..."
                        value={example.assistantResponse}
                        onChange={(e) => updateExample(index, 'assistantResponse', e.target.value)}
                        className="min-h-[100px] resize-none"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {examples.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              No chat examples yet. Add an example to get started.
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={addExample}>
            <Plus className="mr-1 h-3 w-3" />
            New example
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
}
