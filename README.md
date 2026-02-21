# Skill Keep

A local-first web application for managing, versioning, and organizing AI skills (structured prompts and instructions). Built for prompt engineers, AI practitioners, and anyone who needs a version-controlled library of their AI skills — without cloud accounts or third-party storage.

## The Problem

As AI tools become central to daily workflows, people accumulate dozens or hundreds of carefully crafted prompts, system instructions, and agent skills. These end up scattered across text files, notes apps, and chat histories — with no versioning, tagging, or search. Updating a skill means losing the previous version. Sharing or backing up requires manual copy-paste.

**Skill Keep** solves this by providing a dedicated, offline-capable skill manager with built-in version control, tagging, annotations, and optional GitHub synchronization.

## Who Is This For?

- **Prompt engineers** who iterate on skills and need to track what changed between versions
- **Developers** integrating AI into products who maintain a library of system prompts and agent instructions
- **AI power users** who want to organize, tag, and quickly retrieve their best skills
- **Teams** who want to sync a shared skill library via a GitHub repository

## Features

- **Version control** — Every edit creates a new version. Browse history, compare, and restore any previous version.
- **Tagging & filtering** — Organize skills with custom color-coded tags for fast discovery.
- **Version annotations** — Add notes to specific versions to document why a change was made.
- **Chat examples** — Attach example conversations to skills as usage documentation.
- **Skill files** — Attach supporting reference files to skills.
- **Usage notes** — Document what a skill does and how to use it, persisted across versions.
- **GitHub sync** — Push/pull your skill library to a GitHub repo as Markdown files for backup and collaboration.
- **GitHub import** — Import skills directly from public GitHub repositories.
- **Markdown preview** — Rich preview with syntax highlighting for skills written in Markdown.
- **Keyboard shortcuts** — Full keyboard navigation for power users.
- **Dark / light mode** — Automatic theme detection with manual override.
- **Offline-first** — All data lives in your browser (SQLite via IndexedDB). No account required, no data leaves your machine unless you enable GitHub sync.
- **Import / export** — Import and export skills as structured packages (ZIP) or Markdown files.
- **PWA support** — Installable as a progressive web app for desktop-like experience.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, shadcn/ui |
| Local database | SQLite (sql.js) persisted in IndexedDB |
| Sync | GitHub API (optional) |
| State management | TanStack Query |

## ⚠️ Disclaimer

**This project was vibe-coded using [Lovable](https://lovable.dev).** The code has been checked for security issues using Lovable's built-in security scanner, but the repository owner has **not manually reviewed all generated code**. Use at your own discretion and consider performing your own security audit before deploying in sensitive environments.

## Installation & Self-Hosting

This application is a static single-page app with **no backend requirement** for core functionality. It can be installed and used entirely without the Lovable platform.

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

**None are required for core functionality.** The app uses browser-local SQLite storage. The `.env` file in the repository contains Lovable Cloud variables that are not used by the core application and can be safely ignored.

### Supabase / Lovable Cloud Files

You will notice Supabase-related files (`src/integrations/supabase/`, `supabase/config.toml`, `supabase/migrations/`, `supabase/functions/`). These are artifacts from the Lovable Cloud build environment. The `github-fetch-skill` edge function powers the GitHub import feature when hosted on Lovable Cloud. For self-hosted deployments, the core skill management features work fully without these. The files remain because they are read-only and managed by Lovable.

## GitHub Sync Setup

To optionally sync your skills with a GitHub repository:

1. Open **Settings** (gear icon) → **GitHub** section
2. Enter a GitHub **Personal Access Token** (requires `repo` scope)
3. Enter the repository in `owner/repo` format
4. Click **Sync** to push/pull changes

Skills are stored as Markdown files in the `skills-latest/` folder (raw content) and `skills-data/` folder (full metadata) of your repository.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | Create new skill |
| `Ctrl/Cmd + S` | Save current skill |
| `Ctrl/Cmd + C` | Copy skill content |
| `Ctrl/Cmd + K` | Focus search |
| `↑ / ↓` | Navigate skill list |
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
