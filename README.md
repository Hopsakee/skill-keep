# Prompt Library (Skill Keep)

A local-first web application for managing, versioning, and organizing AI prompts — sometimes called "skills." Built for prompt engineers, AI practitioners, and power users who need a structured, version-controlled library of their prompts without relying on cloud accounts or third-party storage.

## The Problem

As AI tools become central to daily workflows, people accumulate dozens or hundreds of carefully crafted prompts. These prompts are scattered across text files, notes apps, and chat histories with no versioning, tagging, or search. Updating a prompt means losing the previous version. Sharing or backing up requires manual copy-paste.

**Prompt Library** solves this by giving you a dedicated, offline-capable prompt manager with built-in version control, tagging, annotation, and optional GitHub synchronization.

## Who Is This For?

- **Prompt engineers** who iterate on prompts and need to track what changed between versions
- **Developers** integrating AI into products who maintain a library of system prompts
- **AI power users** who want to organize, tag, and quickly retrieve their best prompts
- **Teams** who want to sync a shared prompt library via a GitHub repository

## Features

- **Version control** — Every edit creates a new version. Browse history, compare, and restore any previous version.
- **Tagging & filtering** — Organize prompts with custom tags for fast discovery.
- **Version annotations** — Add notes to specific versions to document why a change was made.
- **Chat examples** — Attach example conversations to prompts as usage documentation.
- **Skill files** — Attach supporting files to prompts.
- **GitHub sync** — Push/pull your prompt library to a GitHub repo as Markdown files for backup and collaboration.
- **Markdown preview** — Rich preview with syntax highlighting for prompts written in Markdown.
- **Keyboard shortcuts** — Full keyboard navigation for power users.
- **Dark / light mode** — Automatic theme detection with manual override.
- **Offline-first** — All data lives in your browser (SQLite via IndexedDB). No account required, no data leaves your machine unless you enable GitHub sync.
- **Import / export** — Import and export prompts as structured skill packages (ZIP).

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Local database | SQLite (sql.js) persisted in IndexedDB |
| Sync | GitHub API (optional) |
| State management | TanStack Query |

## ⚠️ Disclaimer

**This project was "vibe-coded" using [Lovable](https://lovable.dev).** The code has been checked for security issues using Lovable's built-in security scanner, but the repository owner has **not manually reviewed all generated code**. Use at your own discretion and consider performing your own security audit before deploying in sensitive environments.

## Installation & Self-Hosting

This application is a static single-page app with **no backend requirement**. It can be installed and used entirely without the Lovable platform.

### Prerequisites

- Node.js 18+ and npm (or Bun)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/<your-username>/skill-keep.git
cd skill-keep

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173`.

### Production Build

```bash
npm run build
```

The output in `dist/` is a fully static site. Deploy it to any static hosting service (Netlify, Vercel, Cloudflare Pages, GitHub Pages, a simple Nginx server, etc.).

### Environment Variables

**None are required.** The app uses browser-local SQLite storage. The `.env` file in the repository contains legacy Lovable Cloud variables that are not used by the application and can be safely ignored.

### Supabase Leftovers

You may notice Supabase-related files (`src/integrations/supabase/`, `supabase/config.toml`, `supabase/migrations/`). These are **obsolete artifacts** from the Lovable Cloud build environment and are not used by the application. They remain because they are read-only and managed by Lovable. You can safely ignore them.

## GitHub Sync Setup

To optionally sync your prompts with a GitHub repository:

1. Open **Settings** (gear icon) → **GitHub** tab
2. Enter a GitHub **Personal Access Token** (requires `repo` scope)
3. Enter the repository in `owner/repo` format
4. Click **Sync** to push/pull changes

Prompts are stored as Markdown files in the `/prompts` folder of your repository.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | Create new prompt |
| `Ctrl/Cmd + S` | Save current prompt |
| `Ctrl/Cmd + C` | Copy prompt content |
| `Ctrl/Cmd + K` | Focus search |
| `↑ / ↓` | Navigate prompt list |
| `Escape` | Clear selection / close dialogs |
| `?` | Show keyboard shortcuts help |

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

## Contributing

Contributions are welcome! Please read the [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Acknowledgments

- Built with [Lovable](https://lovable.dev)
- UI components from [shadcn/ui](https://ui.shadcn.com)
- Local SQL engine by [sql.js](https://github.com/sql-js/sql.js)
