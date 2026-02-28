# Application Flow

How Skill Keep boots and how components connect.

```mermaid
flowchart TD
    Main[main.tsx] --> SW["Clear stale Service Workers and caches"]
    SW --> ReactRoot["ReactDOM.createRoot"]
    ReactRoot --> App[App.tsx]

    App --> QCP[QueryClientProvider]
    QCP --> DBP[DatabaseProvider]
    DBP --> |"await getDatabase()"| DB["database.ts singleton"]
    DB --> |"ready"| Gate{"isReady?"}
    Gate -- "no" --> Loading["Loading spinner"]
    Gate -- "error" --> ErrorScreen["Error message"]
    Gate -- "yes" --> Providers[TooltipProvider + Toaster + Sonner]

    Providers --> Router[BrowserRouter]
    Router --> IndexPage[Index.tsx]

    IndexPage --> Header[Header]
    IndexPage --> SkillList[SkillList]
    IndexPage --> SkillEditor[SkillEditor]

    subgraph DataHooks["Data Access Hooks (useLocalSkills.tsx)"]
        useSkills
        useSkillVersions
        useTags
        useVersionAnnotations
        useChatExamples
        useSkillUsage
        useSkillFiles
    end

    SkillList --> useSkills
    SkillList --> useTags
    SkillEditor --> useSkills
    SkillEditor --> useSkillVersions
    SkillEditor --> useVersionAnnotations
    SkillEditor --> useChatExamples
    SkillEditor --> useSkillUsage
    SkillEditor --> useSkillFiles

    useSkills --> DB
    useSkillVersions --> DB
    useTags --> DB
    useVersionAnnotations --> DB
    useChatExamples --> DB
    useSkillUsage --> DB
    useSkillFiles --> DB
```

## Boot Sequence

1. **main.tsx**: Unregisters stale service workers, clears browser caches, then mounts React
2. **App.tsx**: Sets up `QueryClientProvider` then `DatabaseProvider`
3. **DatabaseProvider**: Calls `getDatabase()` (promise singleton). Blocks rendering until DB is ready
4. **Index.tsx**: Renders the main UI once the database gate opens

## Key Architectural Decisions

- **Single entry point for DB**: All code uses `getDatabase()` which returns the same promise. No race conditions possible.
- **DatabaseProvider gates rendering**: No component can attempt DB access before initialization completes.
- **React Query manages cache**: All reads go through `useQuery`, all writes through `useMutation` with cache invalidation.
- **No backend dependency**: All data lives in the browser via sql.js + IndexedDB.
