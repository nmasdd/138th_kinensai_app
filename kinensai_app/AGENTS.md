# Agents: kinensai_app

## Expo SDK 56
Read versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing code. Expo ~56.0.x, React Native 0.85.3, React 19.2.3, TypeScript ~6.0.3, expo-router ~56.2.x.

## Project structure
- Run all commands inside `kinensai_app/` (repo-root `package.json` is stale, do not use).
- Entry: `src/app/_layout.tsx` (expo-router). 5 tabs in order: camera → timetable → index (home) → search → map. `notifications` is a hidden route (`href: null`), opened from the Header bell.
- Shared `Header` lives in `src/components/` (never under `src/app/`, which would register it as a route). Non-route code lives in `src/data/`, `src/theme.ts` (never under `src/app/`).
- Path alias `@/*` → `src/*`. Tab icons in `icon/` via `require('../../icon/...')`. Map tab icon is a temporary `none.png`.
- No reservation feature: `reservation.tsx`, `ReservationContext`, `reservation/`, `csvLoader`, old `types.ts` were deleted per spec. Do not reintroduce.
- `CLAUDE.md` is a single-line `@AGENTS.md` alias.

## Data layer
- `metro.config.js` keeps `.csv,.txt` in `assetExts`. File IO uses `expo-file-system/legacy` + `Asset.fromModule()`.
- Bundled shared-content canon lives in `src/data/bundled/*.json` (`volunteers.json`, `stage-groups.json`, `auditorium-groups.json`, `class-catalog.json`). TS modules import these; do not reintroduce TS literals. The old `planning/*.txt` loading (`classContent.ts`) and `src/data/classCatalog.json` are removed.
- `src/data/exhibitions.ts` wraps class catalog + overrides into reservation-free `Exhibition` (ticket fields default `unknown`/null until data arrives).
- `src/data/favorites.ts` is a shared external store (`useSyncExternalStore`) so search and map stay in sync; persists favorite IDs via `kvStore` (`favorites.json`; localStorage on web, documentDirectory on native).
- `src/data/timetable.ts` parses `time/Auditorium.csv` (4-col `team,day,start,end`, `day: 0=土,1=日`; 5-col also accepted). `delayMinutes` defaults to 0 — realtime delay feed goes here.
- `src/data/festival.ts` holds home copy excerpted from `HP/` (dates, access, notes, Passione theme). Canonical spec is repo-root `仕様書.md`.
- `src/data/validateContent.ts` validates shared content before publish (errors block publish); surfaced in `/admin/data`.
- Content freshness ≤30s: the Worker serves shared content with `max-age=15, stale-while-revalidate=15` and exposes `GET /api/content/_meta.json` (`{version,updatedAt}`); publish bumps `version`. `src/data/remoteConfig.ts` polls `_meta.json` (startup, `AppState` foreground, every 15s) and appends `?v=<version>` to fetches. `src/context/useContentRefreshKey.ts` (`useContentEffect`) re-runs screen loaders on version change; the root layout calls `useContentAutoRefresh()`.
- Map images in repo-root `校内マップ/` are outside the Metro bundle; place used images under `assets/maps/` before wiring into `src/app/map.tsx`.

## Dev vs prod
- `src/data/remoteConfig.ts`: in dev (`__DEV__`) remote content is OFF by default (bundled values only, no prod-KV fetch/errors). Opt in with `EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1`; override the URL with `EXPO_PUBLIC_CONTENT_URL`. Prod builds always fetch.
- Admin auth is required by default. For local work only, `EXPO_PUBLIC_ADMIN_BYPASS=1` (dev-only; ignored in prod builds).
- `/admin/data`: "公開前チェック" (validation, blocks publish on errors) and "配信中の値を確認" (live prod-KV values). Publishing clears the in-memory remote cache.

## Theme
- Design follows **Google Material Design 3 (Material 3 Expressive)**; motion follows **Apple Human Interface Guidelines (HIG)**. Animations live in `src/components/anim.tsx` (React Native Reanimated) and must respect `useReducedMotion()`. Canonical rules: repo-root `デザインルール.md` and `仕様書.md` §14.
- `src/theme.ts`: white `#ffffff` bg, orange `#FF6B00` primary, ink `#1A1A1A`. Screens use `SafeAreaView` + `Header`. Do not use blue `#208AEF`.
- Responsive scaling: `src/context/responsive.tsx` provides `useM3()` returning `{ scale, type, layout, shape }`, where `type`/`layout`/`shape` are `m3type`/`m3layout`/`m3shape` scaled by `Math.min(1, windowWidth / BASE_WIDTH (390))`. No upscaling (max scale 1); narrow screens shrink only. `ResponsiveProvider` wraps the root Stack in `src/app/_layout.tsx`.
- In components use `const { type, layout, shape, scale } = useM3()` and reference `type.bodyMedium` / `shape.card` / `layout.screenPadding` (NOT the static `m3type`/`m3shape`/`m3layout`). For fixed pixel dimensions in `StyleSheet`, build them with `scaled(n, scale)` (e.g. a local `createStyles(scale, shape)` + `useStyles()`), leaving `borderWidth` and the pill radius (`999`) unscaled. Static `m3type`/`m3layout`/`m3shape` remain exported for the provider's base and for `adminStyles` compatibility.

## Commands / verification
```
npm run start / android / ios / web
npm run lint
powershell -ExecutionPolicy Bypass -Command "node_modules\.bin\eslint src\ --quiet; node_modules\.bin\tsc --noEmit"
```
No test runner. `.expo/types/router.d.ts` regenerates on `expo start` (camera.tsx uses `as never` cast for `/map` until then).
