import { useState, useEffect } from 'react';
import { useChatExamples, ChatMessage } from '@/hooks/useLocalPrompts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Plus, Trash2, User, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ChatExamplesProps {
  versionId: string;
}

export function ChatExamples({ versionId }: ChatExamplesProps) {
  const { chatExample, isLoading, upsertChatExample } = useChatExamples(versionId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setMessages(chatExample?.messages || []);
  }, [chatExample]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertChatExample({ versionId, messages });
    } finally {
      setIsSaving(false);
    }
  };

  const addMessage = (role: 'user' | 'assistant') => {
    setMessages((prev) => [...prev, { role, content: '' }]);
  };

  const updateMessage = (index: number, content: string) => {
    setMessages((prev) =>
      prev.map((msg, i) => (i === index ? { ...msg, content } : msg))
    );
  };

  const removeMessage = (index: number) => {
    setMessages((prev) => prev.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <p className="text-sm text-muted-foreground">
          Voeg chat-voorbeelden toe met user/assistant beurten om context te geven aan deze prompt.
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                'rounded-lg border p-4',
                message.role === 'user' ? 'border-border bg-muted/30' : 'border-accent/30 bg-accent/5'
              )}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {message.role === 'user' ? (
                    <>
                      <User className="h-4 w-4" />
                      User
                    </>
                  ) : (
                    <>
                      <Bot className="h-4 w-4" />
                      Assistant
                    </>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => removeMessage(index)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <Textarea
                placeholder={`${message.role === 'user' ? 'User' : 'Assistant'} bericht...`}
                value={message.content}
                onChange={(e) => updateMessage(index, e.target.value)}
                className="min-h-[80px] resize-none"
              />
            </div>
          ))}

          {messages.length === 0 && (
            <div className="py-8 text-center text-muted-foreground">
              Nog geen chat-voorbeelden. Voeg een bericht toe om te beginnen.
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="border-t border-border p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => addMessage('user')}>
              <Plus className="mr-1 h-3 w-3" />
              User
            </Button>
            <Button variant="outline" size="sm" onClick={() => addMessage('assistant')}>
              <Plus className="mr-1 h-3 w-3" />
              Assistant
            </Button>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      </div>
    </div>
  );
}
