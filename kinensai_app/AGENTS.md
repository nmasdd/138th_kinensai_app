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
- `src/data/classContent.ts` loads `planning/{組}/title.txt, detail.txt` (currently 1A/1B/1C only; extend `CLASS_NAMES` + asset maps together).
- `src/data/exhibitions.ts` wraps class content into reservation-free `Exhibition` (ticket fields default `unknown`/null until data arrives).
- `src/data/favorites.ts` persists favorite IDs to `FileSystem.documentDirectory/favorites.json`.
- `src/data/timetable.ts` parses `time/Auditorium.csv` (4-col `team,day,start,end`, `day: 0=土,1=日`; 5-col also accepted). `delayMinutes` defaults to 0 — realtime delay feed goes here.
- `src/data/festival.ts` holds home copy excerpted from `HP/` (dates, access, notes, Passione theme). Canonical spec is repo-root `仕様書.md`.
- Map images in repo-root `校内マップ/` are outside the Metro bundle; place used images under `assets/maps/` before wiring into `src/app/map.tsx`.

## Theme
- `src/theme.ts`: white `#ffffff` bg, orange `#FF6B00` primary, ink `#1A1A1A`. Screens use `SafeAreaView` + `Header`. Do not use blue `#208AEF`.

## Commands / verification
```
npm run start / android / ios / web
npm run lint
powershell -ExecutionPolicy Bypass -Command "node_modules\.bin\eslint src\ --quiet; node_modules\.bin\tsc --noEmit"
```
No test runner. `.expo/types/router.d.ts` regenerates on `expo start` (camera.tsx uses `as never` cast for `/map` until then).
