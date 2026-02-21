import { useState } from 'react';
import { useSkillFiles, SkillFile } from '@/hooks/useLocalSkills';
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Terminal, FileText, Plus, Pencil, Trash2, Save, X, ChevronDown, ChevronRight, Folder, FolderOpen } from 'lucide-react';

interface SkillFilesProps {
  skillId: string;
}

// ── Validation ──────────────────────────────────────────────────────────────

function validateFilename(name: string, existing: SkillFile[], currentId?: string): string | null {
  if (!name.trim()) return 'Filename is required';
  if (/\s/.test(name)) return 'Filename cannot contain spaces';
  if (!/^[a-zA-Z0-9._\-/]+$/.test(name)) return 'Only letters, numbers, dots, hyphens, underscores, slashes allowed';
  if (name.length > 200) return 'Filename too long (max 200 chars)';
  const duplicate = existing.find((f) => f.filename === name.trim() && f.id !== currentId);
  if (duplicate) return 'A file with this name already exists';
  return null;
}

// ── Small helpers ────────────────────────────────────────────────────────────

function FileTypeIcon({ type }: { type: 'script' | 'reference' }) {
  if (type === 'script') return <Terminal className="h-4 w-4 shrink-0" style={{ color: 'hsl(var(--warning, 38 92% 50%))' }} />;
  return <FileText className="h-4 w-4 shrink-0 text-primary" />;
}

function FileTypeBadge({ type }: { type: 'script' | 'reference' }) {
  if (type === 'script')
    return <Badge variant="outline" className="text-xs">script</Badge>;
  return <Badge variant="secondary" className="text-xs">reference</Badge>;
}

// ── Folder tree helpers ──────────────────────────────────────────────────────

interface FileNode {
  name: string;
  file?: SkillFile;           // leaf
  children?: Map<string, FileNode>; // directory
}

/** Build a tree from a flat list of files that may have paths like "scripts/office/foo.xsd" */
function buildTree(files: SkillFile[]): Map<string, FileNode> {
  const root = new Map<string, FileNode>();

  for (const file of files) {
    const parts = file.filename.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (!current.has(part)) {
        current.set(part, { name: part, children: new Map() });
      }
      const node = current.get(part)!;
      if (i === parts.length - 1) {
        node.file = file;
        node.children = undefined; // leaf
      } else {
        if (!node.children) node.children = new Map();
        current = node.children;
      }
    }
  }

  return root;
}

// ── Add file form ────────────────────────────────────────────────────────────

interface AddFileFormProps {
  promptId: string;
  existingFiles: SkillFile[];
  onClose: () => void;
  upsertFile: (args: { skillId: string; filename: string; file_type: 'script' | 'reference'; content: string; existingId?: string }) => Promise<void>;
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
          <Label className="text-xs">Filename (path)</Label>
          <Input
            placeholder="e.g. scripts/analyze.py"
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

// ── File row (leaf) ──────────────────────────────────────────────────────────

interface FileRowProps {
  file: SkillFile;
  allFiles: SkillFile[];
  label: string; // just the basename to display
  indent: number;
  upsertFile: (args: { promptId: string; filename: string; file_type: 'script' | 'reference'; content: string; existingId?: string }) => Promise<void>;
  deleteFile: (id: string) => Promise<void>;
  isUpserting: boolean;
}

function FileRow({ file, allFiles, label, indent, upsertFile, deleteFile, isUpserting }: FileRowProps) {
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
      promptId: file.skill_id,
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

  const indentPx = indent * 16;

  return (
    <div className="rounded-md border border-border bg-background">
      {/* Collapsed row */}
      <div className="flex items-center gap-2 p-2" style={{ paddingLeft: `${8 + indentPx}px` }}>
        <FileTypeIcon type={file.file_type} />
        <span className="flex-1 font-mono text-sm text-foreground truncate">{label}</span>
        <FileTypeBadge type={file.file_type} />
        <span className="text-xs text-muted-foreground whitespace-nowrap">{file.content.length.toLocaleString()} chars</span>
        <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setExpanded(!expanded)}>
          <Pencil className="mr-1 h-3 w-3" />
          Edit
          {expanded ? <ChevronDown className="ml-1 h-3 w-3" /> : <ChevronRight className="ml-1 h-3 w-3" />}
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
              <Label className="text-xs">Full path</Label>
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

// ── Folder node (collapsible directory) ─────────────────────────────────────

interface FolderNodeProps {
  name: string;
  children: Map<string, FileNode>;
  allFiles: SkillFile[];
  indent: number;
  upsertFile: FileRowProps['upsertFile'];
  deleteFile: FileRowProps['deleteFile'];
  isUpserting: boolean;
  defaultOpen?: boolean;
}

function FolderNode({ name, children, allFiles, indent, upsertFile, deleteFile, isUpserting, defaultOpen = true }: FolderNodeProps) {
  const [open, setOpen] = useState(defaultOpen);

  const totalFiles = countLeaves(children);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded hover:bg-muted/40 transition-colors"
        style={{ paddingLeft: `${8 + indent * 16}px` }}
      >
        {open
          ? <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          : <Folder className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
        <span className="text-xs font-medium text-muted-foreground">{name}/</span>
        <span className="text-xs text-muted-foreground/60 ml-1">({totalFiles})</span>
        {open
          ? <ChevronDown className="h-3 w-3 ml-auto text-muted-foreground/50" />
          : <ChevronRight className="h-3 w-3 ml-auto text-muted-foreground/50" />}
      </button>

      {open && (
        <div className="space-y-1 mt-1">
          <TreeNodes
            nodes={children}
            allFiles={allFiles}
            indent={indent + 1}
            upsertFile={upsertFile}
            deleteFile={deleteFile}
            isUpserting={isUpserting}
          />
        </div>
      )}
    </div>
  );
}

function countLeaves(nodes: Map<string, FileNode>): number {
  let count = 0;
  for (const node of nodes.values()) {
    if (node.file) count++;
    else if (node.children) count += countLeaves(node.children);
  }
  return count;
}

// ── Tree renderer ────────────────────────────────────────────────────────────

interface TreeNodesProps {
  nodes: Map<string, FileNode>;
  allFiles: SkillFile[];
  indent: number;
  upsertFile: FileRowProps['upsertFile'];
  deleteFile: FileRowProps['deleteFile'];
  isUpserting: boolean;
}

function TreeNodes({ nodes, allFiles, indent, upsertFile, deleteFile, isUpserting }: TreeNodesProps) {
  const sorted = [...nodes.entries()].sort(([, a], [, b]) => {
    // directories first, then files
    const aDir = !a.file;
    const bDir = !b.file;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <>
      {sorted.map(([key, node]) => {
        if (node.file) {
          return (
            <FileRow
              key={key}
              file={node.file}
              allFiles={allFiles}
              label={node.name}
              indent={indent}
              upsertFile={upsertFile}
              deleteFile={deleteFile}
              isUpserting={isUpserting}
            />
          );
        }
        return (
          <FolderNode
            key={key}
            name={node.name}
            children={node.children!}
            allFiles={allFiles}
            indent={indent}
            upsertFile={upsertFile}
            deleteFile={deleteFile}
            isUpserting={isUpserting}
          />
        );
      })}
    </>
  );
}

// ── Section (Scripts / Reference files) with collapsible header ──────────────

interface SectionProps {
  icon: React.ReactNode;
  label: string;
  count: number;
  files: SkillFile[];
  allFiles: SkillFile[];
  upsertFile: FileRowProps['upsertFile'];
  deleteFile: FileRowProps['deleteFile'];
  isUpserting: boolean;
  defaultOpen?: boolean;
}

function Section({ icon, label, count, files, allFiles, upsertFile, deleteFile, isUpserting, defaultOpen = true }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const tree = buildTree(files);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="flex items-center gap-2 w-full text-left group">
          <div className="flex items-center gap-2 flex-1">
            {icon}
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {label} ({count})
            </span>
          </div>
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-2 space-y-1">
          <TreeNodes
            nodes={tree}
            allFiles={allFiles}
            indent={0}
            upsertFile={upsertFile}
            deleteFile={deleteFile}
            isUpserting={isUpserting}
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function SkillFiles({ skillId }: SkillFilesProps) {
  const { files, upsertFile, deleteFile, isLoading, isUpserting, isDeleting } = useSkillFiles(skillId);
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
          <Section
            icon={<Terminal className="h-4 w-4 text-muted-foreground" />}
            label="Scripts"
            count={scripts.length}
            files={scripts}
            allFiles={files}
            upsertFile={upsertFile}
            deleteFile={deleteFile}
            isUpserting={isUpserting || isDeleting}
          />
        )}

        {/* Reference files section */}
        {references.length > 0 && (
          <Section
            icon={<FileText className="h-4 w-4 text-muted-foreground" />}
            label="Reference files"
            count={references.length}
            files={references}
            allFiles={files}
            upsertFile={upsertFile}
            deleteFile={deleteFile}
            isUpserting={isUpserting || isDeleting}
          />
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
