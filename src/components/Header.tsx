import { Button } from '@/components/ui/button';
import { Settings, Keyboard, Database, RefreshCw, Loader2, Github } from 'lucide-react';
import { useGitHubSync } from '@/hooks/useLocalGitHubSync';
import { SyncConflictDialog } from '@/components/SyncConflictDialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

import { Tags } from 'lucide-react';

interface HeaderProps {
  onOpenSettings: () => void;
  onOpenShortcuts: () => void;
  onOpenTagManagement: () => void;
}

export function Header({ onOpenSettings, onOpenShortcuts, onOpenTagManagement }: HeaderProps) {
  const {
    config,
    isSyncing,
    sync,
    conflicts,
    conflictIndex,
    resolveConflict,
    cancelConflictResolution,
  } = useGitHubSync();

  const isConnected = config?.connected;

  return (
    <>
      <header className="flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          <span className="text-xl font-semibold tracking-tight">Skill Keep</span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Local</span>
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isConnected ? 'default' : 'outline'}
                  size="sm"
                  onClick={isConnected ? sync : onOpenSettings}
                  disabled={isSyncing}
                  className="gap-2"
                >
                  {isSyncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isConnected ? (
                    <RefreshCw className="h-4 w-4" />
                  ) : (
                    <Github className="h-4 w-4" />
                  )}
                  {isConnected ? 'Sync' : 'Connect GitHub'}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isConnected
                  ? `Sync with ${config.owner}/${config.repo}`
                  : 'Connect a GitHub repository'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button variant="ghost" size="icon" onClick={onOpenTagManagement} title="Tag management (Ctrl+T)">
            <Tags className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenShortcuts} title="Keyboard shortcuts (?)">
            <Keyboard className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onOpenSettings} title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <SyncConflictDialog
        open={conflicts.length > 0}
        conflicts={conflicts}
        currentIndex={conflictIndex}
        onResolve={resolveConflict}
        onCancel={cancelConflictResolution}
      />
    </>
  );
}
