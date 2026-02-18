import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface ConflictInfo {
  title: string;
  filename: string;
  local: { content: string; updated_at: string; wordCount: number };
  remote: { content: string; updated_at: string; wordCount: number };
}

interface SyncConflictDialogProps {
  open: boolean;
  conflicts: ConflictInfo[];
  currentIndex: number;
  onResolve: (choice: 'local' | 'remote' | 'both') => void;
  onCancel: () => void;
}

export function SyncConflictDialog({
  open,
  conflicts,
  currentIndex,
  onResolve,
  onCancel,
}: SyncConflictDialogProps) {
  if (conflicts.length === 0) return null;

  const conflict = conflicts[currentIndex];
  const localDate = new Date(conflict.local.updated_at);
  const remoteDate = new Date(conflict.remote.updated_at);
  const isLocalNewer = localDate > remoteDate;
  const isRemoteNewer = remoteDate > localDate;

  const formatDate = (date: Date) =>
    date.toLocaleDateString('nl-NL', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Conflict: {conflict.title}</DialogTitle>
          <DialogDescription>
            Dit prompt bestaat zowel lokaal als op GitHub met verschillende inhoud.
            <br />
            Conflict {currentIndex + 1} van {conflicts.length}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          {/* Local version */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Lokale versie</h3>
              <div className="flex gap-1">
                {isLocalNewer && <Badge variant="default">Nieuwer</Badge>}
                {conflict.local.wordCount > conflict.remote.wordCount && (
                  <Badge variant="secondary">Meer woorden</Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Bijgewerkt: {formatDate(localDate)}
            </p>
            <p className="text-sm text-muted-foreground">
              {conflict.local.wordCount} woorden
            </p>
            <div className="bg-muted rounded p-2 max-h-32 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap">
                {conflict.local.content.substring(0, 500)}
                {conflict.local.content.length > 500 && '...'}
              </pre>
            </div>
            <Button onClick={() => onResolve('local')} variant="outline" className="w-full">
              Lokaal behouden
            </Button>
          </div>

          {/* Remote version */}
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">GitHub versie</h3>
              <div className="flex gap-1">
                {isRemoteNewer && <Badge variant="default">Nieuwer</Badge>}
                {conflict.remote.wordCount > conflict.local.wordCount && (
                  <Badge variant="secondary">Meer woorden</Badge>
                )}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Bijgewerkt: {formatDate(remoteDate)}
            </p>
            <p className="text-sm text-muted-foreground">
              {conflict.remote.wordCount} woorden
            </p>
            <div className="bg-muted rounded p-2 max-h-32 overflow-y-auto">
              <pre className="text-xs whitespace-pre-wrap">
                {conflict.remote.content.substring(0, 500)}
                {conflict.remote.content.length > 500 && '...'}
              </pre>
            </div>
            <Button onClick={() => onResolve('remote')} variant="outline" className="w-full">
              GitHub behouden
            </Button>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <Button variant="ghost" onClick={onCancel}>
            Annuleren
          </Button>
          <Button variant="secondary" onClick={() => onResolve('both')}>
            Beide behouden
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
