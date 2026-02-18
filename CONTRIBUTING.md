# Contributing to Prompt Library

Thank you for your interest in contributing to this project! 

## ⚠️ Important Notice

This project was "vibe-coded" using [Lovable](https://lovable.dev). The original author has not manually reviewed all the code. Please keep this in mind when contributing.

## ⚠️ Supabase Leftovers (Obsolete)

You may notice several Supabase-related files in this repository:

- `src/integrations/supabase/` - Auto-generated Supabase client and types
- `.env` - Contains Supabase environment variables
- `supabase/config.toml` - Supabase configuration file
- `supabase/migrations/` - Database migration files

**These files are obsolete and not used by the application.** The app now uses:
- **SQLite (sql.js)** stored in browser IndexedDB for local data storage
- **GitHub API** for syncing prompts as Markdown files

The Supabase files remain because they are **read-only and locked by Lovable Cloud**, which auto-generates and manages them. See [Issue #1](../../issues/1) for more details.

When contributing, you can safely ignore these files - they have no effect on the application's functionality.

## How to Contribute

### Reporting Bugs

1. Check if the issue already exists in the [Issues](../../issues) section
2. If not, create a new issue with:
   - A clear, descriptive title
   - Steps to reproduce the problem
   - Expected vs actual behavior
   - Screenshots if applicable
   - Your environment (browser, OS)

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

## Coding Standards

- **TypeScript**: Use proper types, avoid `any`
- **React**: Use functional components with hooks
- **Styling**: Use Tailwind CSS utility classes and the design system tokens from `index.css`
- **Components**: Keep components small and focused
- **Naming**: Use descriptive variable and function names

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

Note: No environment variables are required for local development. The app uses browser-based SQLite storage.

## Code Review Process

1. All PRs require at least one review
2. Address feedback promptly
3. Keep PRs focused and reasonably sized

## Security

If you discover a security vulnerability, please **do not** open a public issue. Instead, contact the maintainers directly.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
