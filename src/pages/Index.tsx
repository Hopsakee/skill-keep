import { useState, useRef, useCallback } from 'react';
import { Prompt, useTags } from '@/hooks/useLocalPrompts';
import { Header } from '@/components/Header';
import { PromptList, PromptListRef } from '@/components/PromptList';
import { PromptEditor, PromptEditorRef } from '@/components/PromptEditor';
import { SettingsDialog } from '@/components/SettingsDialog';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';
import { TagManagementDialog } from '@/components/TagManagementDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { toast } from 'sonner';

export default function Index() {
  const [selectedPrompt, setSelectedPrompt] = useState<Prompt | null>(null);
  const [isNewPrompt, setIsNewPrompt] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tagManagementOpen, setTagManagementOpen] = useState(false);
  const promptListRef = useRef<PromptListRef>(null);
  const promptEditorRef = useRef<PromptEditorRef>(null);
  const { tags } = useTags();

  const handleCopyActivePrompt = useCallback(async () => {
    if (selectedPrompt?.active_version?.content) {
      try {
        await navigator.clipboard.writeText(selectedPrompt.active_version.content);
        toast.success(`"${selectedPrompt.title}" gekopieerd naar clipboard`);
      } catch {
        toast.error('Kopiëren mislukt');
      }
    } else {
      toast.error('Geen prompt geselecteerd om te kopiëren');
    }
  }, [selectedPrompt]);

  useKeyboardShortcuts({
    onNewPrompt: () => {
      setSelectedPrompt(null);
      setIsNewPrompt(true);
    },
    onCopyActivePrompt: handleCopyActivePrompt,
    onNavigateUp: () => promptListRef.current?.navigateUp(),
    onNavigateDown: () => promptListRef.current?.navigateDown(),
    onSave: () => {
      promptEditorRef.current?.triggerSave();
    },
    onEscape: () => {
      setSelectedPrompt(null);
      setIsNewPrompt(false);
    },
    onFocusSearch: () => promptListRef.current?.focusSearch(),
    onShowHelp: () => setShortcutsOpen(true),
    onNewVersion: () => {
      if (selectedPrompt && !isNewPrompt) {
        promptEditorRef.current?.startNewVersion();
      }
    },
    onSwitchTab: (tabIndex: number) => {
      if (selectedPrompt || isNewPrompt) {
        promptEditorRef.current?.switchTab(tabIndex);
      }
    },
    onFocusTagInput: () => {
      const tagInput = document.getElementById('tag-input');
      if (tagInput) {
        tagInput.focus();
      }
    },
    onToggleTag: (tagIndex: number) => {
      if ((selectedPrompt || isNewPrompt) && tags[tagIndex]) {
        promptEditorRef.current?.toggleTagByIndex(tagIndex);
      }
    },
    onOpenTagManagement: () => setTagManagementOpen(true),
  });

  const handleSelectPrompt = (prompt: Prompt) => {
    setSelectedPrompt(prompt);
    setIsNewPrompt(false);
  };

  const handleNewPrompt = () => {
    setSelectedPrompt(null);
    setIsNewPrompt(true);
  };

  const handleSave = () => {
    setIsNewPrompt(false);
  };

  const handleCancel = () => {
    setSelectedPrompt(null);
    setIsNewPrompt(false);
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <Header 
        onOpenSettings={() => setSettingsOpen(true)} 
        onOpenShortcuts={() => setShortcutsOpen(true)}
        onOpenTagManagement={() => setTagManagementOpen(true)}
      />
      
      <div className="flex flex-1 overflow-hidden">
        <div className="w-80 shrink-0">
          <PromptList
            ref={promptListRef}
            selectedPromptId={selectedPrompt?.id || null}
            onSelectPrompt={handleSelectPrompt}
            onNewPrompt={handleNewPrompt}
          />
        </div>
        
        <main className="flex-1 overflow-hidden bg-background">
          <PromptEditor
            ref={promptEditorRef}
            prompt={selectedPrompt}
            isNew={isNewPrompt}
            onSave={handleSave}
            onCancel={handleCancel}
          />
        </main>
      </div>

      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <KeyboardShortcutsDialog open={shortcutsOpen} onOpenChange={setShortcutsOpen} />
      <TagManagementDialog open={tagManagementOpen} onOpenChange={setTagManagementOpen} />
    </div>
  );
}
