import { useState, useEffect } from 'react';
import { useVersionAnnotations } from '@/hooks/useLocalSkills';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Save } from 'lucide-react';

interface VersionAnnotationsProps {
  versionId: string;
}

export function VersionAnnotations({ versionId }: VersionAnnotationsProps) {
  const { annotation, isLoading, upsertAnnotation } = useVersionAnnotations(versionId);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setNote(annotation?.note || '');
  }, [annotation]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertAnnotation({ versionId, note });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Add notes to this version. These stay linked to the version and are not inherited by new versions.
        </p>
      </div>
      
      <div className="flex-1">
        <Textarea
          placeholder="Write your notes here..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-full min-h-[200px] resize-none"
        />
      </div>
      
      <div className="mt-4 flex justify-end">
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="mr-2 h-4 w-4" />
          {isSaving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
