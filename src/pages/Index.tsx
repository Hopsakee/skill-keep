import { useState, useRef, useCallback } from 'react';
import { Skill, useTags } from '@/hooks/useLocalSkills';
import { Header } from '@/components/Header';
import { SkillList, SkillListRef } from '@/components/SkillList';
import { SkillEditor, SkillEditorRef } from '@/components/SkillEditor';
import { SettingsDialog } from '@/components/SettingsDialog';
import { KeyboardShortcutsDialog } from '@/components/KeyboardShortcutsDialog';
import { TagManagementDialog } from '@/components/TagManagementDialog';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { toast } from 'sonner';

export default function Index() {
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [isNewSkill, setIsNewSkill] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [tagManagementOpen, setTagManagementOpen] = useState(false);
  const skillListRef = useRef<SkillListRef>(null);
  const skillEditorRef = useRef<SkillEditorRef>(null);
  const { tags } = useTags();

  const handleCopyActiveSkill = useCallback(async () => {
    if (selectedSkill?.active_version?.content) {
      try {
        await navigator.clipboard.writeText(selectedSkill.active_version.content);
        toast.success(`"${selectedSkill.title}" copied to clipboard`);
      } catch {
        toast.error('Copy failed');
      }
    } else {
      toast.error('No skill selected to copy');
    }
  }, [selectedSkill]);

  useKeyboardShortcuts({
    onNewSkill: () => {
      setSelectedSkill(null);
      setIsNewSkill(true);
    },
    onCopyActiveSkill: handleCopyActiveSkill,
    onNavigateUp: () => skillListRef.current?.navigateUp(),
    onNavigateDown: () => skillListRef.current?.navigateDown(),
    onSave: () => {
      skillEditorRef.current?.triggerSave();
    },
    onEscape: () => {
      setSelectedSkill(null);
      setIsNewSkill(false);
    },
    onFocusSearch: () => skillListRef.current?.focusSearch(),
    onShowHelp: () => setShortcutsOpen(true),
    onNewVersion: () => {
      if (selectedSkill && !isNewSkill) {
        skillEditorRef.current?.startNewVersion();
      }
    },
    onSwitchTab: (tabIndex: number) => {
      if (selectedSkill || isNewSkill) {
        skillEditorRef.current?.switchTab(tabIndex);
      }
    },
    onFocusTagInput: () => {
      const tagInput = document.getElementById('tag-input');
      if (tagInput) {
        tagInput.focus();
      }
    },
    onToggleTag: (tagIndex: number) => {
      if ((selectedSkill || isNewSkill) && tags[tagIndex]) {
        skillEditorRef.current?.toggleTagByIndex(tagIndex);
      }
    },
    onOpenTagManagement: () => setTagManagementOpen(true),
  });

  const handleSelectSkill = (skill: Skill) => {
    setSelectedSkill(skill);
    setIsNewSkill(false);
  };

  const handleNewSkill = () => {
    setSelectedSkill(null);
    setIsNewSkill(true);
  };

  const handleSave = () => {
    setIsNewSkill(false);
  };

  const handleCancel = () => {
    setSelectedSkill(null);
    setIsNewSkill(false);
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
          <SkillList
            ref={skillListRef}
            selectedSkillId={selectedSkill?.id || null}
            onSelectSkill={handleSelectSkill}
            onNewSkill={handleNewSkill}
          />
        </div>
        
        <main className="flex-1 overflow-hidden bg-background">
          <SkillEditor
            ref={skillEditorRef}
            skill={selectedSkill}
            isNew={isNewSkill}
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
