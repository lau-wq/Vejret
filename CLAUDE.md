# CLAUDE.md

Guidance for AI assistants (Claude Code) working in this repository.

## Project overview

**Vejret** (Danish for "the weather") is a weather web app built with
TypeScript + React + Vite. It shows current conditions, the next 12 hours,
and a 7-day forecast for any city (default: Copenhagen), with a city search
box. All UI text is in Danish.

Weather and geocoding data come from the free **Open-Meteo** API
(https://open-meteo.com) — no API key or account is required, and there are
no secrets in this project.

The repository owner is not a programmer; when communicating about this
project, prefer plain, non-technical Danish explanations.

## Commands

```sh
npm install        # install dependencies (first time only)
npm run dev        # start dev server (http://localhost:5173)
npm run build      # type-check (tsc -b) and build production bundle to dist/
npm run preview    # serve the production build locally
```

There is no test suite or linter configured yet.

## Structure

```
index.html            # Vite entry HTML (lang="da")
src/
  main.tsx            # React entry point
  App.tsx             # entire UI: search, current weather, hourly strip, 7-day list
  api/weather.ts      # Open-Meteo client + WMO weather-code → Danish text/emoji mapping
  index.css           # all styling (plain CSS, no framework)
```

## Conventions

- TypeScript strict mode (see `tsconfig.app.json`); `verbatimModuleSyntax` is
  on, so type-only imports must use `import type`.
- Danish is used for UI strings, and Danish identifiers appear in app code
  (`hentVejr`, `soegSted`, `Sted`, `Vejrdata`) — follow that style.
- No state-management or styling libraries; plain React hooks and plain CSS.
  Keep it that way unless the owner asks for more.
- Weather codes are WMO codes; extend the `VEJRKODER` map in
  `src/api/weather.ts` if new codes need handling.
- Wind speed is requested in m/s (`wind_speed_unit=ms`), timezone is `auto`.

## Things to know

- In the remote Claude Code sandbox, outbound requests to `api.open-meteo.com`
  are blocked by the network policy (proxy returns 403). The app still works in
  a real browser. To verify UI changes end-to-end in the sandbox, use
  Playwright with `page.route('**/api.open-meteo.com/**', ...)` to serve mock
  forecast JSON (see the shape in `src/api/weather.ts` `Vejrdata`).
- Keep this file current: update it in the same commit whenever commands,
  structure, or conventions change.
