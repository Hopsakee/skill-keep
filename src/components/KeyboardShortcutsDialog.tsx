import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface KeyboardShortcutsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  { category: 'Navigation', items: [
    { keys: ['↑', 'K'], description: 'Previous skill' },
    { keys: ['↓', 'J'], description: 'Next skill' },
    { keys: ['/'], description: 'Focus search bar' },
    { keys: ['Esc'], description: 'Deselect / Cancel' },
    { keys: ['1'], description: 'Go to Skill tab' },
    { keys: ['2'], description: 'Go to Deployment notes tab' },
    { keys: ['3'], description: 'Go to Test examples tab' },
    { keys: ['4'], description: 'Go to Notes tab' },
  ]},
  { category: 'Actions', items: [
    { keys: ['N'], description: 'New skill' },
    { keys: ['E'], description: 'Create new version' },
    { keys: ['Ctrl', 'S'], description: 'Save' },
    { keys: ['Ctrl', 'Shift', 'K'], description: 'Copy active skill' },
  ]},
  { category: 'Tags', items: [
    { keys: ['T'], description: 'Focus tag input' },
    { keys: ['Alt', '1-9'], description: 'Toggle tag 1-9' },
    { keys: ['Ctrl', 'T'], description: 'Open tag management' },
  ]},
  { category: 'Help', items: [
    { keys: ['?'], description: 'Show shortcuts' },
  ]},
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Skill Keep - Help</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold">About this app</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Skill Keep is a local app for managing agent skills. Each change to a skill 
              creates a new version, so you can always return to earlier versions.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>• <strong>Deployment notes</strong> – Explanation of the purpose and usage of the skill (preserved between versions)</li>
              <li>• <strong>Test examples</strong> – Examples of user prompts and assistant responses (per version, user prompts are copied)</li>
              <li>• <strong>Version notes</strong> – Notes per version to document changes</li>
            </ul>
          </div>

          <Separator className="my-4" />

          <div className="space-y-6">
            <h3 className="text-sm font-semibold">Keyboard shortcuts</h3>
            {shortcuts.map((section) => (
              <div key={section.category}>
                <h4 className="mb-3 text-sm font-medium text-muted-foreground">
                  {section.category}
                </h4>
                <div className="space-y-2">
                  {section.items.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">{shortcut.description}</span>
                      <div className="flex items-center gap-1">
                        {shortcut.keys.map((key, index) => (
                          <span key={index} className="flex items-center gap-1">
                            <Kbd>{key}</Kbd>
                            {index < shortcut.keys.length - 1 && (
                              <span className="text-xs text-muted-foreground">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <p className="mt-4 text-xs text-muted-foreground">
          Tip: On Mac you can use ⌘ instead of Ctrl
        </p>
      </DialogContent>
    </Dialog>
  );
}
