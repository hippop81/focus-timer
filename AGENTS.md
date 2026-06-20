# AGENTS.md

## Cursor Cloud specific instructions

`focus-timer` is a single, frontend-only Vite + React + TypeScript SPA (Pomodoro/focus timer, Japanese UI). There is no backend, database, or test framework.

- Dev server: `npm run dev` (Vite, port `5173`). The app is served under the base path `/focus-timer/`, so open `http://localhost:5173/focus-timer/` (the bare root returns 404).
- Build + typecheck: `npm run build` (runs `tsc` then `vite build`). This is the only "test" available — there is no lint script and no automated tests.
- Preview production build: `npm run preview` (port `4173`, also under `/focus-timer/`).
- AI OCR/explanation features (`src/lib/claude.ts`) call the Anthropic API directly from the browser using a key the user pastes into the app UI (stored in `localStorage`). All other features (timer, tasks, stats, ambient audio via Web Audio synthesis) work fully offline.
