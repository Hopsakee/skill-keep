# Prompt Library

A modern web application for managing, versioning, and organizing AI prompts. Built for prompt engineers, developers, and teams who want to maintain a structured library of their prompts with version control and GitHub synchronization.

## ⚠️ Disclaimer

**This project was "vibe-coded" using [Lovable](https://lovable.dev).** The code has been checked for security issues using Lovable's built-in security scanner, but the repository owner has **not manually reviewed the code**. Use at your own discretion and consider performing your own security audit before deploying to production environments.

## Features

- **Prompt Management**: Create, edit, and delete prompts with a clean, intuitive interface
- **Version Control**: Every edit creates a new version, allowing you to track changes and restore previous versions
- **Tagging System**: Organize prompts with custom tags for easy filtering and discovery
- **Version Annotations**: Add notes to specific versions to document changes or important details
- **Chat Examples**: Attach example conversations to prompts for better context
- **GitHub Sync**: Synchronize your prompt library to a GitHub repository for backup and collaboration
- **Keyboard Shortcuts**: Power-user friendly with comprehensive keyboard navigation
- **Dark/Light Mode**: Automatic theme detection with manual override option

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui components
- **Database**: SQLite (sql.js) stored in browser IndexedDB
- **Sync**: GitHub API for Markdown file sync
- **State Management**: TanStack Query (React Query)

## Data Storage

Your prompts are stored locally in your browser using SQLite (via sql.js) persisted in IndexedDB. You can find your data in:
- **Browser DevTools** → Application → IndexedDB → `prompt-vault-db`

Data syncs to GitHub as individual Markdown files in the `/prompts` folder.

## ⚠️ Supabase Leftovers (Obsolete)

This project contains leftover files from Supabase/Lovable Cloud that are **no longer used**:

- `src/integrations/supabase/` - Contains auto-generated Supabase client and types
- `.env` - Contains Supabase environment variables
- `supabase/config.toml` - Supabase configuration file
- `supabase/migrations/` - Database migration files

**These files are obsolete.** The app now uses local SQLite (IndexedDB) for data storage and GitHub for sync. However, these files cannot be removed because they are **read-only and locked by Lovable Cloud**.

See [Issue #1: Remove obsolete Supabase files](../../issues/1) for more details and potential workarounds.

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- (Optional) A GitHub account for the sync feature

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd <project-directory>
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`.

### 4. Build for Production

```bash
npm run build
```

The build output will be in the `dist` directory, ready to be deployed to any static hosting service.

## GitHub Sync Setup

To sync your prompts with GitHub:

1. Go to Settings (gear icon) → GitHub tab
2. Enter your GitHub Personal Access Token (requires `repo` scope)
3. Enter the repository in format `owner/repo`
4. Click "Sync" to pull/push changes

Your prompts will be stored as Markdown files in the `/prompts` folder of your repository.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | Create new prompt |
| `Ctrl/Cmd + S` | Save current prompt |
| `Ctrl/Cmd + C` | Copy prompt content |
| `Ctrl/Cmd + K` | Focus search |
| `↑ / ↓` | Navigate prompt list |
| `Escape` | Clear selection / Close dialogs |
| `?` | Show keyboard shortcuts help |

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read the [Contributing Guidelines](CONTRIBUTING.md) before submitting a PR.

## Acknowledgments

- Built with [Lovable](https://lovable.dev) - AI-powered web development platform
- UI components from [shadcn/ui](https://ui.shadcn.com)
