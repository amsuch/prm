# prm-sc

Hybrid web + mobile app built with Expo (React Native) and Supabase.

## Tech Stack

- **Framework**: Expo with expo-router (web + iOS + Android from one codebase)
- **Language**: TypeScript (strict mode)
- **Backend**: Supabase (Postgres, Auth, Realtime, Storage)
- **Package Manager**: pnpm
- **Styling**: TBD (likely NativeWind / Tailwind CSS for React Native)

## Development Environment

This project uses VS Code devcontainers. All development happens inside the container.

## Agent Isolation Rules

**You are running inside a devcontainer. You MUST follow these rules:**

1. **Filesystem**: Only read/write files under `/workspaces/prm-sc`. Do NOT attempt to access any path outside this directory.
2. **Git**: Only interact with the `prm-sc` repository. Do NOT push to or create PRs on any repository outside of `kelihi/prm-sc`.
3. **Network**: You may fetch documentation, search the web, and install packages from npm. Do NOT make requests to internal/private services you were not explicitly told about.
4. **Secrets**: Never log, print, or write API keys or secrets to files. Use environment variables exclusively.
5. **No host access**: Do not attempt to access Docker sockets, host filesystems, or break out of the container in any way.

## Project Structure (planned)

```
/workspaces/prm-sc/
  .devcontainer/       # Devcontainer config (Dockerfile + devcontainer.json)
  app/                 # Expo Router pages (file-based routing)
  components/          # Shared UI components
  lib/                 # Utilities, Supabase client, helpers
  constants/           # App-wide constants (colors, config)
  hooks/               # Custom React hooks
  types/               # Shared TypeScript types
  assets/              # Images, fonts, static files
```

## Commands

```bash
pnpm dev              # Start Expo dev server (web + mobile)
pnpm dev:web          # Start web only
pnpm dev:ios          # Start iOS simulator
pnpm dev:android      # Start Android emulator
pnpm lint             # Run ESLint
pnpm typecheck        # Run TypeScript type checking
```

## Conventions

- Use functional components with hooks
- Prefer named exports over default exports
- Keep components small and focused; extract shared logic into hooks
- Supabase client lives in `lib/supabase.ts` — import from there, don't create new clients
- Environment variables go in `.env.local` (gitignored) — see `.env.example` for required vars
- File-based routing via expo-router: each file in `app/` is a route
