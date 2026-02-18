import { useState, useEffect } from 'react';
import { usePromptUsage } from '@/hooks/useLocalPrompts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Pencil, X } from 'lucide-react';
import { MarkdownPreview } from './MarkdownPreview';

interface PromptUsageProps {
  promptId: string;
}

export function PromptUsage({ promptId }: PromptUsageProps) {
  const { usage, isLoading, upsertUsage } = usePromptUsage(promptId);
  const [explanation, setExplanation] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setExplanation(usage?.explanation || '');
  }, [usage]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertUsage({ promptId, explanation });
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setExplanation(usage?.explanation || '');
    setIsEditing(false);
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Laden...</div>;
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Beschrijf wat deze prompt doet en hoe je hem kunt gebruiken. Deze toelichting blijft behouden tussen versies.
        </p>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Bewerken
          </Button>
        )}
      </div>
      
      <div className="flex-1 min-h-0">
        {isEditing ? (
          <Textarea
            placeholder="Beschrijf het doel en gebruik van deze prompt..."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            className="h-full min-h-[200px] resize-none"
          />
        ) : (
          <div className="h-full min-h-[200px] rounded-md border border-input bg-muted/30">
            {explanation ? (
              <MarkdownPreview content={explanation} className="h-full" />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Nog geen toelichting toegevoegd. Klik op "Bewerken" om een toelichting toe te voegen.
              </div>
            )}
          </div>
        )}
      </div>
      
      {isEditing && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <X className="mr-2 h-4 w-4" />
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Opslaan...' : 'Opslaan'}
          </Button>
        </div>
      )}
    </div>
  );
}
