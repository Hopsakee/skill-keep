import { useEffect, useCallback } from 'react';

interface KeyboardShortcutsOptions {
  onNewSkill: () => void;
  onCopyActiveSkill: () => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onSave: () => void;
  onEscape: () => void;
  onFocusSearch: () => void;
  onShowHelp: () => void;
  onNewVersion?: () => void;
  onSwitchTab?: (tabIndex: number) => void;
  onFocusTagInput?: () => void;
  onToggleTag?: (tagIndex: number) => void;
  onOpenTagManagement?: () => void;
}

export function useKeyboardShortcuts({
  onNewSkill,
  onCopyActiveSkill,
  onNavigateUp,
  onNavigateDown,
  onSave,
  onEscape,
  onFocusSearch,
  onShowHelp,
  onNewVersion,
  onSwitchTab,
  onFocusTagInput,
  onToggleTag,
  onOpenTagManagement,
}: KeyboardShortcutsOptions) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      const isInputFocused =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable;

      // Global shortcuts (work even in inputs)
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        onSave();
        return;
      }

      // Ctrl/Cmd+Shift+K for copy
      if ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onCopyActiveSkill();
        return;
      }

      // Ctrl/Cmd+T for tag management
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 't' && onOpenTagManagement) {
        event.preventDefault();
        onOpenTagManagement();
        return;
      }

      // Alt+1-9 for toggling tags (works in inputs too)
      if (event.altKey && onToggleTag) {
        const num = parseInt(event.key);
        if (num >= 1 && num <= 9) {
          event.preventDefault();
          onToggleTag(num - 1);
          return;
        }
      }

      // Escape - blur input first, then call handler
      if (event.key === 'Escape') {
        if (isInputFocused) {
          (target as HTMLElement).blur();
        }
        onEscape();
        return;
      }

      // Shortcuts that only work when not in an input
      if (!isInputFocused) {
        // N for new skill
        if (event.key === 'n') {
          event.preventDefault();
          onNewSkill();
          return;
        }

        // E for edit/new version
        if (event.key === 'e' && onNewVersion) {
          event.preventDefault();
          onNewVersion();
          return;
        }

        // T for focus tag input
        if (event.key === 't' && onFocusTagInput) {
          event.preventDefault();
          onFocusTagInput();
          return;
        }

        // Number keys for tab switching
        if (onSwitchTab) {
          if (event.key === '1') { event.preventDefault(); onSwitchTab(0); return; }
          if (event.key === '2') { event.preventDefault(); onSwitchTab(1); return; }
          if (event.key === '3') { event.preventDefault(); onSwitchTab(2); return; }
          if (event.key === '4') { event.preventDefault(); onSwitchTab(3); return; }
        }

        // Arrow keys for navigation
        if (event.key === 'ArrowUp' || event.key === 'k') {
          event.preventDefault();
          onNavigateUp();
          return;
        }

        if (event.key === 'ArrowDown' || event.key === 'j') {
          event.preventDefault();
          onNavigateDown();
          return;
        }

        // / for search
        if (event.key === '/') {
          event.preventDefault();
          onFocusSearch();
          return;
        }

        // ? for help
        if (event.key === '?' || (event.shiftKey && event.key === '/')) {
          event.preventDefault();
          onShowHelp();
          return;
        }
      }
    },
    [onNewSkill, onCopyActiveSkill, onNavigateUp, onNavigateDown, onSave, onEscape, onFocusSearch, onShowHelp, onNewVersion, onSwitchTab, onFocusTagInput, onToggleTag, onOpenTagManagement]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
