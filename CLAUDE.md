# CLAUDE.md

Guidance for AI assistants (Claude Code) working in this repository.

## Project overview

**Vejret** (Danish for "the weather") is a weather web app built with
TypeScript + React + Vite. It **compares forecasts from two national weather
models** — DMI Harmonie (Denmark) and MET Norway (the model behind YR) — for
any city, with a city search box. On load it asks for browser geolocation and
uses the user's position as the default, reverse-geocoding the place name via
BigDataCloud's keyless client API ("<by> (din placering)"); it falls back to
Copenhagen if denied. All UI text is in
Danish. It shows current conditions per model (big temp, "feels like", icon,
wind — no humidity by owner request), a 48-hour temperature line chart with
per-model weather-icon rows, a 48-hour wind chart (lines + gust band per
model + direction-arrow rows under the axis), a combined 48-hour
precipitation chart (mm bars per model on the left axis + probability lines
on a fixed 0–100 % right axis — a deliberate dual-axis chart chosen by the
owner, mitigated by distinct mark types and labeled axes), a precipitation
radar card, a UV-index card for the current day, and a 7-day comparison
table (collapsed in a `<details>` by default; there is no hourly table —
the owner had it removed).

The UV card (`UvGraf` in `components/grafer.tsx`) shows today only, cropped
to the daylight window: the elapsed part of the day is gray, the rest is
colored by UV level via a vertical SVG gradient using the status palette
(green `#0ca30c` 0–2, yellow `#fab219` 3–5 "solcreme", orange `#ec835a` 6–7,
red `#d03b3b` 8+), with a "nu" dot/hairline and a "maks" label. Data comes
from best_match `uv_index` (fetched together with precipitation probability
in `hentSamletPrognose`).

The radar card starts centered on Denmark (fixed center, regardless of the
searched city) at zoom 6, with +/− zoom buttons (zoom 5–9) and drag-to-pan
(clamped to roughly the Nordics). Tiles are computed dynamically from
center/zoom via Web-Mercator math in `components/radar.tsx`: CARTO dark
**nolabels** basemap + RainViewer composite tiles (both keyless) + an own
label layer with Danish city names (curated `BYER` list with per-city
min-zoom), and a slider spanning ~60 min back (10-min steps) and
RainViewer's ~30 min nowcast forward (`nowcast` can be empty — labels are
computed dynamically). The slider uses a neutral gray accent (owner request:
no blue). All chart legends use stroke keys (no square swatches — owner
request).

Weather and geocoding data come from the free **Open-Meteo** API
(https://open-meteo.com) using its per-model endpoints
(`models=dmi_seamless` / `models=metno_seamless`; precipitation probability
from the default `best_match`). No API key or account is required, and there
are no secrets in this project. Note: `metno_seamless` only covers the
Nordics — the UI degrades to a single-model view outside coverage.

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
index.html               # Vite entry HTML (lang="da")
.github/workflows/       # deploy.yml: builds and publishes to the gh-pages branch
src/
  main.tsx               # React entry point
  App.tsx                # UI: search, per-model "now" cards, charts, 7-day table
  api/weather.ts         # Open-Meteo client (per-model fetches) + WMO code → Danish text
  components/grafer.tsx  # hand-rolled SVG charts: LinjeGraf, SoejleGraf, KombiGraf,
                         #   VindGraf, IkonRaekker (+ shared tooltip/frame)
  components/ikoner.tsx  # Vejrikon: WMO code → minimal stroke-SVG glyph
  components/radar.tsx   # RadarKort: RainViewer + CARTO tiles, time slider
  index.css              # all styling (plain CSS, no framework)
```

Deployed at https://lau-wq.github.io/Vejret/ (Vite `base: '/Vejret/'`); every
push to the dev branch rebuilds and republishes via GitHub Actions.

## Conventions

- TypeScript strict mode (see `tsconfig.app.json`); `verbatimModuleSyntax` is
  on, so type-only imports must use `import type`.
- Danish is used for UI strings, and Danish identifiers appear in app code
  (`hentVejr`, `soegSted`, `Sted`, `Vejrdata`) — follow that style.
- No state-management, styling, or charting libraries; plain React hooks,
  plain CSS, and hand-rolled SVG charts. Keep it that way unless the owner
  asks for more.
- **Design language: dark, strict, minimal** (owner's explicit preference —
  no emoji, no gradients, no playfulness). Color roles live as CSS custom
  properties in `src/index.css`. Series colors: DMI `#3987e5` (blue),
  YR `#199e70` (green), precipitation probability `#9085e9` (violet) —
  validated for CVD/contrast on the dark surface; keep chart specs (2px
  lines, hairline grids, tooltips, legends) consistent with
  `components/grafer.tsx`.
- Weather codes are WMO codes; extend the `VEJRKODER` map in
  `src/api/weather.ts` if new codes need handling.
- Weather icons are hand-drawn stroke-SVGs in `components/ikoner.tsx`
  (1.6px stroke, currentColor) — never emoji, never an icon font/library.
- Wind speed is requested in m/s (`wind_speed_unit=ms`), timezone is `auto`.

## Things to know

- In the remote Claude Code sandbox, outbound requests to `api.open-meteo.com`
  are blocked by the network policy (proxy returns 403). The app still works in
  a real browser. To verify UI changes end-to-end in the sandbox, use
  Playwright with `page.route('**/api.open-meteo.com/**', ...)` to serve mock
  forecast JSON (see the shape in `src/api/weather.ts` `Vejrdata`).
- Keep this file current: update it in the same commit whenever commands,
  structure, or conventions change.
