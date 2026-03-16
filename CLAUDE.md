# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # Type-check + production build
npm run preview  # Preview production build
```

> Node.js must be in PATH. If `npm` is not found, use the full path: `C:\Program Files\nodejs\npm.cmd`

## Architecture

Single-page React app scaffolded with Vite. Entry point: `src/main.tsx` → `src/App.tsx`.

- **Styling:** Tailwind CSS v4 — configured entirely via `src/index.css` (`@import "tailwindcss"`). No `tailwind.config.js`.
- **Backend:** Supabase JS (`@supabase/supabase-js`) is installed and ready to use for auth, database, and realtime.
- **Build:** `@tailwindcss/vite` plugin handles Tailwind processing; `@vitejs/plugin-react` handles JSX.

TypeScript uses split config: `tsconfig.app.json` for `src/`, `tsconfig.node.json` for `vite.config.ts`.

## Conventions

- React components go in `src/components/`
- Game state management goes in `src/store/`
- Variable and file names in English; comments in Polish
- Do not install new UI libraries without asking the user first
