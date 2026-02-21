# Contributing to Skill Keep

Thank you for your interest in contributing!

## ⚠️ Important Notice

This project was **vibe-coded** using [Lovable](https://lovable.dev). The repository owner has not manually reviewed all generated code. Security has been checked using Lovable's built-in scanner, but please keep this in mind when contributing — you may encounter patterns that look unusual.

## ⚠️ Supabase / Lovable Cloud Files

You will notice several Supabase-related files in this repository:

- `src/integrations/supabase/` — Auto-generated client and types
- `.env` — Contains Lovable Cloud environment variables
- `supabase/config.toml` — Supabase configuration
- `supabase/migrations/` — Database migration files
- `supabase/functions/` — Edge functions (used for GitHub import on Lovable Cloud)

**These files are managed by Lovable Cloud and should not be edited manually.** The core app uses:
- **SQLite (sql.js)** stored in browser IndexedDB for local data storage
- **GitHub API** for optional skill synchronization

You can safely ignore these files when contributing to core functionality.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in [Issues](../../issues)
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the problem
   - Expected vs. actual behavior
   - Screenshots if applicable
   - Your browser and OS

### Suggesting Features

1. Open a new issue with the `enhancement` label
2. Describe the feature and its use case
3. Explain why it would benefit other users

### Code Contributions

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create a branch** for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make your changes** following the coding standards below
5. **Test** your changes thoroughly
6. **Commit** with clear, descriptive messages
7. **Push** to your fork
8. **Open a Pull Request** with:
   - A clear description of the changes
   - Reference to any related issues
   - Screenshots for UI changes

## Development Setup

```bash
git clone <your-fork-url>
cd skill-keep
npm install
npm run dev
```

No environment variables are required. The app uses browser-local SQLite storage.

## Coding Standards

- **TypeScript**: Use proper types; avoid `any`
- **React**: Functional components with hooks
- **Styling**: Tailwind CSS utility classes and semantic design tokens from `index.css`
- **Components**: Keep components small and focused
- **Naming**: Use descriptive variable and function names

## Code Review Process

1. All PRs require at least one review
2. Address feedback promptly
3. Keep PRs focused and reasonably sized

## Security

If you discover a security vulnerability, please **do not** open a public issue. Instead, contact the maintainers directly.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
