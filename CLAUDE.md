# CLAUDE.md

Guidance for AI assistants (Claude Code) working in this repository.

## Project overview

**Vejret** (Danish for "the weather") is a weather application. The repository
is newly created and **not yet scaffolded** — as of 2026-07-13 it contains no
source code. This file documents the intended setup so assistants have a
starting point; it is based on stated intent, not existing code.

> **Important:** Update this file as soon as the project is scaffolded or the
> plans below change. Do not treat the sections below as descriptions of code
> that exists — verify against the actual repository state first.

## Intended tech stack

- **Language:** TypeScript (strict mode)
- **Framework:** React
- **Build tool:** Vite
- **Package manager:** npm
- **Weather data:** an external weather API is expected (e.g. DMI Open Data or
  OpenWeather). API keys belong in `.env` files, which must be gitignored —
  never commit secrets.

## Commands (once scaffolded)

These are the expected standard commands after Vite scaffolding — they do
**not** work yet. Check `package.json` scripts before running anything.

```sh
npm install        # install dependencies
npm run dev        # start Vite dev server
npm run build      # type-check and produce production build
npm run lint       # lint (if/when configured)
npm test           # run tests (if/when configured)
```

## Planned structure (tentative)

```
index.html          # Vite entry HTML
src/
  main.tsx          # app entry point
  App.tsx           # root component
  components/       # reusable UI components
  api/              # weather API client code
public/             # static assets
```

## Guidance for AI assistants

- **Scaffolding:** if asked to bootstrap the project, use
  `npm create vite@latest . -- --template react-ts`, then update this file to
  reflect reality (actual scripts, structure, dependencies).
- **Don't invent state:** never claim commands or files exist without checking;
  the repo may still be empty or only partially set up.
- **Keep this file current:** whenever the stack, commands, structure, or
  conventions change, update CLAUDE.md in the same commit.
- **Secrets:** weather API keys and other credentials go in `.env` /
  `.env.local` (gitignored). Provide a committed `.env.example` with variable
  names only.
