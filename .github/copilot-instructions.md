# Project Guidelines

## Build and Verify

- Run `npm run lint` and `npm run build` after code changes.
- Use `npm run watch` for local iterative development.
- Run `npm run test:integration` for Yale API integration tests when local credentials are configured.
- Integration tests are manual and require `.env.test.local` (`YALE_USERNAME`, `YALE_PASSWORD`).

## Testing Conventions

- Integration tests live under `test/integration/` and use Vitest with `vitest.integration.config.ts`.
- Keep Yale integration tests read-only by default (GET-style calls such as `getPanelState`, `panel`, `motionSensors`, and `contactSensors`).
- Do not add state-changing Yale API calls to baseline integration coverage unless explicitly requested.
- Keep local secrets in `.env.test.local` only; do not commit real credentials.
- If credentials are missing, tests should fail with clear setup guidance and skip live API assertions.

## Architecture

- `src/index.ts` registers the Homebridge platform.
- `src/platform.ts` owns platform lifecycle: config decode/validate, Yale API initialization, accessory discovery, and polling.
- `src/platformAccessory.ts` owns Security System characteristic handlers, Yale API reads/writes, and state translation.
- `src/helpers/platformConfig.ts` contains config defaults and validation rules.
- `src/helpers/contexts.ts` and `src/helpers/functions.ts` contain shared typed context objects and utility helpers.

## Code Style

- This repo uses TypeScript with strict mode and ESM modules (`module: ES2022`).
- Follow ESLint rules from `eslint.config.js` (single quotes, semicolons, trailing commas, braces required).
- Prefer explicit types and `import type` where appropriate.
- Preserve or extend existing JSDoc comments when changing public behavior.

## Plugin Conventions and Constraints

- The platform is singular (`config.schema.json` sets `"singular": true`): assume one Yale panel accessory.
- Keep refresh interval validation aligned in both `config.schema.json` and `src/helpers/platformConfig.ts` (minimum 5 seconds).
- Yale Sync integration is polling-based only (no webhooks), so avoid assumptions of instant push updates.
- Respect API debouncing in `src/platformAccessory.ts` (`lastApiCall` cache window of 1 second) to prevent excessive calls.
- Preserve Yale/HAP state mappings:
    - Yale `Armed` -> HAP `AWAY_ARM`
    - Yale `Home` -> HAP `NIGHT_ARM`
    - Yale `Disarmed` -> HAP `DISARMED`
    - HAP `STAY_ARM` and `NIGHT_ARM` -> Yale `Home`
- In characteristic handlers, network/API failures should throw `HapStatusError(SERVICE_COMMUNICATION_FAILURE)` to signal "Not Responding" correctly.
- Never log credentials (`username`, `password`) and do not hardcode secrets.

## Change Checklist

- If you add or change config fields, update both `config.schema.json` and `YaleConfigHandler` decode/validate logic.
- If you change alarm state behavior, update translation methods and characteristic updates together.
- If you modify lifecycle polling, preserve the `backgroundRefresh` exit behavior and logging cadence intent.
