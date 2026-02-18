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
  { category: 'Navigatie', items: [
    { keys: ['↑', 'K'], description: 'Vorige prompt' },
    { keys: ['↓', 'J'], description: 'Volgende prompt' },
    { keys: ['/'], description: 'Focus zoekbalk' },
    { keys: ['Esc'], description: 'Deselecteer / Annuleer' },
    { keys: ['1'], description: 'Ga naar Prompt tab' },
    { keys: ['2'], description: 'Ga naar Toelichting gebruik tab' },
    { keys: ['3'], description: 'Ga naar Chat-voorbeelden tab' },
    { keys: ['4'], description: 'Ga naar Notities tab' },
  ]},
  { category: 'Acties', items: [
    { keys: ['N'], description: 'Nieuwe prompt' },
    { keys: ['E'], description: 'Nieuwe versie maken' },
    { keys: ['Ctrl', 'S'], description: 'Opslaan' },
    { keys: ['Ctrl', 'Shift', 'K'], description: 'Kopieer actieve prompt' },
  ]},
  { category: 'Tags', items: [
    { keys: ['T'], description: 'Focus tag invoerveld' },
    { keys: ['Alt', '1-9'], description: 'Toggle tag 1-9' },
    { keys: ['Ctrl', 'T'], description: 'Open tag beheer' },
  ]},
  { category: 'Help', items: [
    { keys: ['?'], description: 'Toon sneltoetsen' },
  ]},
];

export function KeyboardShortcutsDialog({ open, onOpenChange }: KeyboardShortcutsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Prompt Vault - Help</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          {/* App description */}
          <div className="mb-6">
            <h3 className="mb-2 text-sm font-semibold">Over deze app</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Prompt Vault is een lokale app voor het beheren van prompts. Elke wijziging aan een prompt 
              creëert een nieuwe versie, zodat je altijd kunt terugkeren naar eerdere versies.
            </p>
            <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
              <li>• <strong>Toelichting gebruik</strong> – Uitleg over het doel en gebruik van de prompt (blijft behouden tussen versies)</li>
              <li>• <strong>Chat-voorbeelden</strong> – Voorbeelden van user prompts en assistant responses (per versie, user prompts worden gekopieerd)</li>
              <li>• <strong>Notities versies</strong> – Notities per versie om wijzigingen te documenteren</li>
            </ul>
          </div>

          <Separator className="my-4" />

          {/* Keyboard shortcuts */}
          <div className="space-y-6">
            <h3 className="text-sm font-semibold">Sneltoetsen</h3>
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
          Tip: Op Mac kun je ⌘ gebruiken in plaats van Ctrl
        </p>
      </DialogContent>
    </Dialog>
  );
}
