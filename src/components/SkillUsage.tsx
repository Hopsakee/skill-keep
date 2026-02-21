import { useState, useEffect } from 'react';
import { useSkillUsage } from '@/hooks/useLocalSkills';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save, Pencil, X } from 'lucide-react';
import { MarkdownPreview } from './MarkdownPreview';

interface SkillUsageProps {
  skillId: string;
}

export function SkillUsage({ skillId }: SkillUsageProps) {
  const { usage, isLoading, upsertUsage } = useSkillUsage(skillId);
  const [explanation, setExplanation] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setExplanation(usage?.explanation || '');
  }, [usage]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertUsage({ skillId, explanation });
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
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Describe what this skill does and how to use it. These notes persist across versions.
        </p>
        {!isEditing && (
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
      </div>
      
      <div className="flex-1 min-h-0">
        {isEditing ? (
          <Textarea
            placeholder="Describe the purpose and usage of this skill..."
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
                No deployment notes yet. Click "Edit" to add notes.
              </div>
            )}
          </div>
        )}
      </div>
      
      {isEditing && (
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={handleCancel}>
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      )}
    </div>
  );
}
