import { useState, useEffect } from 'react';
import { useAllVersionAnnotations, useVersionAnnotations } from '@/hooks/useLocalSkills';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Save } from 'lucide-react';
import { toast } from 'sonner';

interface AllVersionNotesProps {
  skillId: string;
  activeVersionId: string;
}

export function AllVersionNotes({ skillId, activeVersionId }: AllVersionNotesProps) {
  const { data: allAnnotations, isLoading: isLoadingAll, refetch } = useAllVersionAnnotations(skillId);
  const { annotation: currentAnnotation, upsertAnnotation } = useVersionAnnotations(activeVersionId);
  const [currentNote, setCurrentNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setCurrentNote(currentAnnotation?.note || '');
  }, [currentAnnotation]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await upsertAnnotation({ versionId: activeVersionId, note: currentNote });
      await refetch();
      toast.success('Note saved');
    } catch {
      toast.error('Save failed');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoadingAll) {
    return <div className="p-4 text-muted-foreground">Loading...</div>;
  }

  const annotationsWithContent = allAnnotations?.filter(a => a.note && a.note.trim()) || [];

  return (
    <div className="flex h-full flex-col">
      {/* Current version note editor */}
      <div className="border-b border-border p-4">
        <h3 className="mb-2 text-sm font-semibold">Current version note</h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Add a note for the active version. Previous version notes are shown below.
        </p>
        <Textarea
          placeholder="Write your note for this version..."
          value={currentNote}
          onChange={(e) => setCurrentNote(e.target.value)}
          className="min-h-[100px] resize-none"
        />
        <div className="mt-3 flex justify-end">
          <Button onClick={handleSave} disabled={isSaving} size="sm">
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Previous version notes */}
      <div className="flex-1 overflow-hidden">
        <div className="border-b border-border px-4 py-2">
          <h3 className="text-sm font-semibold text-muted-foreground">Previous version notes</h3>
        </div>
        <ScrollArea className="h-[calc(100%-40px)]">
          <div className="p-4">
            {annotationsWithContent.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground">
                No notes on previous versions yet.
              </p>
            ) : (
              <div className="space-y-4">
                {annotationsWithContent.map((annotation, index) => (
                  <div key={annotation.id}>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold">
                        Version {annotation.version_number}
                      </h4>
                      {annotation.created_at && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(annotation.created_at)}
                        </span>
                      )}
                    </div>
                    <p className="whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm">
                      {annotation.note}
                    </p>
                    {index < annotationsWithContent.length - 1 && (
                      <Separator className="mt-4" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
