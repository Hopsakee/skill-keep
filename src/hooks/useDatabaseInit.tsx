import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getDatabase } from '@/lib/database';

interface DatabaseContextType {
  isReady: boolean;
  error: Error | null;
}

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export function DatabaseProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getDatabase()
      .then(() => setIsReady(true))
      .catch((err) => {
        console.error('Failed to initialize database:', err);
        setError(err);
      });
  }, []);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="text-destructive font-medium">Database fout</div>
          <div className="text-muted-foreground text-sm mt-2">{error.message}</div>
        </div>
      </div>
    );
  }

  if (!isReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Database laden...</div>
      </div>
    );
  }

  return (
    <DatabaseContext.Provider value={{ isReady, error }}>
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase() {
  const context = useContext(DatabaseContext);
  if (context === undefined) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
}
