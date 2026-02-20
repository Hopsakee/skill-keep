import { useState } from 'react';
import { useSkillFiles, SkillFile } from '@/hooks/useLocalPrompts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal, FileText, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronUp } from 'lucide-react';

interface SkillFilesProps {
  promptId: string;
}

function validateFilename(name: string, existing: SkillFile[], currentId?: string): string | null {
  if (!name.trim()) return 'Filename is required';
  if (/\s/.test(name)) return 'Filename cannot contain spaces';
  if (!/^[a-zA-Z0-9._\-]+$/.test(name)) return 'Only letters, numbers, dots, hyphens, underscores allowed';
  if (name.length > 100) return 'Filename too long (max 100 chars)';
  const duplicate = existing.find((f) => f.filename === name.trim() && f.id !== currentId);
  if (duplicate) return 'A file with this name already exists';
  return null;
}

function FileTypeIcon({ type }: { type: 'script' | 'reference' }) {
  if (type === 'script') return <Terminal className="h-4 w-4" style={{ color: 'hsl(var(--warning, 38 92% 50%))' }} />;
  return <FileText className="h-4 w-4 text-primary" />;
}

function FileTypeBadge({ type }: { type: 'script' | 'reference' }) {
  if (type === 'script')
    return (
      <Badge variant="outline" className="text-xs">
        script
      </Badge>
    );
  return (
    <Badge variant="secondary" className="text-xs">
      reference
    </Badge>
  );
}

interface AddFileFormProps {
  promptId: string;
  existingFiles: SkillFile[];
  onClose: () => void;
  upsertFile: (args: { promptId: string; filename: string; file_type: 'script' | 'reference'; content: string; existingId?: string }) => Promise<void>;
  isUpserting: boolean;
}

function AddFileForm({ promptId, existingFiles, onClose, upsertFile, isUpserting }: AddFileFormProps) {
  const [filename, setFilename] = useState('');
  const [fileType, setFileType] = useState<'script' | 'reference'>('reference');
  const [content, setContent] = useState('');
  const [filenameError, setFilenameError] = useState<string | null>(null);

  const handleFilenameChange = (val: string) => {
    setFilename(val);
    setFilenameError(validateFilename(val, existingFiles));
  };

  const handleSave = async () => {
    const err = validateFilename(filename, existingFiles);
    if (err) { setFilenameError(err); return; }
    await upsertFile({ promptId, filename: filename.trim(), file_type: fileType, content });
    onClose();
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-4 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Plus className="h-4 w-4" />
        Add new file
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Filename</Label>
          <Input
            placeholder="e.g. analyze.py"
            value={filename}
            onChange={(e) => handleFilenameChange(e.target.value)}
            className="h-8 text-sm font-mono"
          />
          {filenameError && <p className="text-xs text-destructive">{filenameError}</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Type</Label>
          <Select value={fileType} onValueChange={(v) => setFileType(v as 'script' | 'reference')}>
            <SelectTrigger className="h-8 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reference">Reference file</SelectItem>
              <SelectItem value="script">Script</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Content</Label>
          <span className="text-xs text-muted-foreground">{content.length.toLocaleString()} chars</span>
        </div>
        <Textarea
          placeholder="File content..."
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[160px] font-mono text-sm resize-y"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onClose}>
          <X className="mr-1 h-3 w-3" />
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={isUpserting || !!filenameError || !filename.trim()}>
          <Save className="mr-1 h-3 w-3" />
          {isUpserting ? 'Saving...' : 'Save file'}
        </Button>
      </div>
    </div>
  );
}

interface FileRowProps {
  file: SkillFile;
  allFiles: SkillFile[];
  upsertFile: (args: { promptId: string; filename: string; file_type: 'script' | 'reference'; content: string; existingId?: string }) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  isUpserting: boolean;
}

function FileRow({ file, allFiles, upsertFile, deleteFile, isUpserting }: FileRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [editFilename, setEditFilename] = useState(file.filename);
  const [editType, setEditType] = useState<'script' | 'reference'>(file.file_type);
  const [editContent, setEditContent] = useState(file.content);
  const [filenameError, setFilenameError] = useState<string | null>(null);

  const handleFilenameChange = (val: string) => {
    setEditFilename(val);
    setFilenameError(validateFilename(val, allFiles, file.id));
  };

  const handleSave = async () => {
    const err = validateFilename(editFilename, allFiles, file.id);
    if (err) { setFilenameError(err); return; }
    await upsertFile({
      promptId: file.prompt_id,
      filename: editFilename.trim(),
      file_type: editType,
      content: editContent,
      existingId: file.id,
    });
    setExpanded(false);
  };

  const handleCancel = () => {
    setEditFilename(file.filename);
    setEditType(file.file_type);
    setEditContent(file.content);
    setFilenameError(null);
    setExpanded(false);
  };

  return (
    <div className="rounded-md border border-border bg-background">
      {/* Collapsed row */}
      <div className="flex items-center gap-2 p-3">
        <FileTypeIcon type={file.file_type} />
        <span className="flex-1 font-mono text-sm text-foreground">{file.filename}</span>
        <FileTypeBadge type={file.file_type} />
        <span className="text-xs text-muted-foreground">{file.content.length.toLocaleString()} chars</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpanded(!expanded)}>
          <Pencil className="mr-1 h-3 w-3" />
          Edit
          {expanded ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-destructive hover:text-destructive">
              <Trash2 className="h-3 w-3" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete {file.filename}?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete this file from the skill. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteFile(file.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="border-t border-border p-3 space-y-3 bg-muted/10">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Filename</Label>
              <Input
                value={editFilename}
                onChange={(e) => handleFilenameChange(e.target.value)}
                className="h-8 text-sm font-mono"
              />
              {filenameError && <p className="text-xs text-destructive">{filenameError}</p>}
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={editType} onValueChange={(v) => setEditType(v as 'script' | 'reference')}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reference">Reference file</SelectItem>
                  <SelectItem value="script">Script</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Content</Label>
              <span className="text-xs text-muted-foreground">{editContent.length.toLocaleString()} chars</span>
            </div>
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[200px] font-mono text-sm resize-y"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              <X className="mr-1 h-3 w-3" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isUpserting || !!filenameError}>
              <Save className="mr-1 h-3 w-3" />
              {isUpserting ? 'Saving...' : 'Save changes'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function SkillFiles({ promptId }: SkillFilesProps) {
  const { files, upsertFile, deleteFile, isLoading, isUpserting, isDeleting } = useSkillFiles(promptId);
  const [showAddForm, setShowAddForm] = useState(false);

  const scripts = files.filter((f) => f.file_type === 'script');
  const references = files.filter((f) => f.file_type === 'reference');

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Loading files...
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold">Bundled files</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Level 3 resources — scripts and reference docs loaded on-demand by skill instructions.
            </p>
          </div>
          {!showAddForm && (
            <Button size="sm" variant="outline" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-1 h-3 w-3" />
              Add file
            </Button>
          )}
        </div>

        {/* Add file form */}
        {showAddForm && (
          <AddFileForm
            promptId={promptId}
            existingFiles={files}
            onClose={() => setShowAddForm(false)}
            upsertFile={upsertFile}
            isUpserting={isUpserting}
          />
        )}

        {/* Scripts section */}
        {scripts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Scripts ({scripts.length})
              </span>
            </div>
            <div className="space-y-2">
              {scripts.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  allFiles={files}
                  upsertFile={upsertFile}
                  deleteFile={deleteFile}
                  isUpserting={isUpserting || isDeleting}
                />
              ))}
            </div>
          </div>
        )}

        {/* Reference files section */}
        {references.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Reference files ({references.length})
              </span>
            </div>
            <div className="space-y-2">
              {references.map((file) => (
                <FileRow
                  key={file.id}
                  file={file}
                  allFiles={files}
                  upsertFile={upsertFile}
                  deleteFile={deleteFile}
                  isUpserting={isUpserting || isDeleting}
                />
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {files.length === 0 && !showAddForm && (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">No bundled files yet</p>
            <p className="text-xs mt-1 max-w-xs">
              Add scripts (.py, .js, .sh) or reference markdown files that this skill's instructions can reference.
            </p>
            <Button size="sm" variant="outline" className="mt-4" onClick={() => setShowAddForm(true)}>
              <Plus className="mr-1 h-3 w-3" />
              Add first file
            </Button>
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
