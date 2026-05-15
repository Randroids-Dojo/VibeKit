# @randroids-dojo/vibekit

Reusable components and bootstrap for vibe-coded games and apps. Self-contained TypeScript modules used across multiple projects in this workspace (VibeRacer, Flatline, VibeCity, VibeGear2, FrackingAsteroids). Each module is:

- zero-dependency at runtime (apart from `zod` and, for `./server`, `@upstash/redis` + `node:crypto`),
- framework-agnostic on the default entry (no React, no Next.js, no DOM-only globals beyond what the module's domain needs),
- pure TypeScript that compiles with `tsc` alone,
- documented at the top of its file.

The kit has no build step. Consume it by either copy-pasting a `.ts` file into your project, or by adding this repo as a `file:` dependency:

```json
{
  "dependencies": {
    "@randroids-dojo/vibekit": "file:../VibeKit"
  }
}
```

## Versioning

Releases are automated via [release-please](https://github.com/googleapis/release-please). Every push to `main` opens or updates a Release PR titled `chore(main): release X.Y.Z` with a CHANGELOG entry and a version bump. Merging that PR creates the git tag `vX.Y.Z`.

Use Conventional Commits in PR titles / squash-merge messages so release-please picks the right semver level:

- `fix:` or `chore:` → patch (0.1.0 → 0.1.1)
- `feat:` → minor pre-1.0; once we cut 1.0, `feat:` → minor and breaking → major
- `feat!:` or `BREAKING CHANGE:` in the body → major

Pre-1.0 the kit treats every `feat:` as a patch via `bump-patch-for-minor-pre-major: true`, so daily authoring stays at `0.1.x` until we cut 1.0.0 deliberately.

## Modules

### `virtual-joystick`

Float-where-you-tap touch joystick state. `createJoystick` / `beginJoystick` / `moveJoystick` / `endJoystick` mutate state from pointer events; `readJoystick` returns a `[-1, 1]` deflection vector clamped at `JOYSTICK_RADIUS`. The consumer applies `JOYSTICK_DEADZONE` itself so different consumers can pick different thresholds.

### `editor-history`

Generic `EditorHistory<T>` undo / redo stack. `createHistory` / `pushHistory` / `undoHistory` / `redoHistory` / `replacePresent` / `resetHistory` plus `canUndo` / `canRedo` flags. Reference-equal pushes are no-ops so an idempotent setter does not pollute the past stack with duplicates. The past stack caps at `EDITOR_HISTORY_MAX_PAST = 100`.

### `confetti`

Pure particle simulation for celebration overlays. `spawnConfettiBatch` (seeded RNG, count, palette, burst origin), `stepConfetti` (one physics frame), `confettiAlpha` (per-particle fade), `isBatchExpired`, `makeRng` (re-exported here too for convenience). Coordinates are normalized 0-1 viewport space; the renderer multiplies by canvas pixel size at draw time.

### `rng`

Tiny seeded Mulberry32 PRNG. `makeRng(seed)` returns a deterministic float-in-[0, 1) generator; `range(rng, lo, hi)`, `pick(rng, items)`, and `gauss(rng)` are convenience helpers. Use these in any system that needs reproducible randomness (replays, deterministic spawns, ghost integrity).

### `math`

`TAU`, `clamp`, `lerp`, `inverseLerp`, `remap`, `smoothstep`, `wrapAngle`. Pure helpers re-implemented in many game projects; pulling them here so the same definition is shared and tested once.

### `storage`

Defensive `localStorage` helpers validated with zod schemas. Every function is SSR-safe (returns sensibly when `window` is missing), JSON-safe (catches parse failure), schema-safe (rejects values that fail the supplied zod schema), and quota-safe (writes return `false` on quota errors instead of throwing).

- `readStorage<T>(key, schema)` returns `T | null`.
- `writeStorage(key, value)` returns `false` on SSR / quota / cyclic value, fires a same-tab change event on success.
- `removeStorage(key)` clears and fires the change event.
- `updateStorage<T>(key, schema, prev => next)` is read-modify-write convenience.
- `listenStorage(key, onChange)` subscribes to BOTH cross-tab `storage` events AND same-tab `gamekit:storage` CustomEvents (the standard `storage` event does not fire in the window that wrote the change). Returns an unsubscribe function.
- `notifyStorageChange(key)` dispatches the same-tab event without writing, useful when state is reconstructed from another source.

Zod is the only runtime dependency in the kit; consumers pass a `z.ZodSchema<T>` directly. There is no React hook layer; project-side hooks compose `readStorage` + `listenStorage` for the hydrate-after-mount pattern.

### `rim-scoring-sensor`

Engine-agnostic ordered basketball scoring gate. `createRimScoringSensorState()` creates per-ball state, and `updateRimScoringSensor(state, params)` returns `'swish'`, `'score'`, `'rim'`, or `null`. A make only counts after a descending ball enters the above-rim shaft and then crosses the lower gate inside the rim cylinder, which prevents net-from-below false positives.

## Server modules — `@randroid/game-kit/server`

Server-only helpers that import `@upstash/redis` and `node:crypto`. Import path is the `./server` subpath, never the root, so a stray client import errors loudly:

```ts
import { getKv, readKv, writeKv, signToken, verifyToken, incrementWithExpiry } from '@randroid/game-kit/server'
```

### `getKv()` and `readKv` / `writeKv` / `removeKv`

`getKv()` returns an `@upstash/redis` `Redis` client when `KV_REST_API_URL` and `KV_REST_API_TOKEN` are populated, or `null` otherwise. Returning null lets routes degrade gracefully in local dev or preview deploys without a KV binding.

`readKv<T>(kv, key, schema)` issues `GET`, validates the parsed value against a zod schema, and returns `T | null`. Upstash auto-parses JSON on reads. `writeKv(kv, key, value, { ttlSec? })` issues `SET` with optional TTL; returns `false` on thrown access. `removeKv(kv, key)` issues `DEL` swallowing failures.

### `signToken` / `verifyToken`

HMAC-SHA256 signed tokens for race-start / replay / admin flows. The encoding is intentionally simpler than JWT (no algorithm header, no expiration parsing): a `<base64url(json)>.<base64url(hmac)>` string. `verifyToken<T>(token, secret, schema?)` returns the parsed payload on success or `null` on any failure (signature mismatch, malformed token, JSON parse failure, schema rejection). Comparison is constant-time via `timingSafeEqual`.

### `incrementWithExpiry`

Fixed-window rate-limit primitive. `incrementWithExpiry(kv, key, windowSec)` issues `INCR` then sets `EXPIRE` on the first hit. Returns the post-increment count. Caller picks the policy (compare to a limit, return 429 when over). Returns `null` only when both `INCR` and `EXPIRE` throw; pick a fail-open or fail-closed policy explicitly when this happens.

## Adding a module

A module qualifies for this kit when it satisfies all of:

1. zero project imports (`grep "from '@/" <file>` returns empty);
2. no React, Vue, Next.js, or any framework imports;
3. pure TypeScript that compiles with `tsc --noEmit` alone;
4. tests that pin behavior with Vitest;
5. documented public API at the top of the file.

If a module is *almost* portable but reaches into a project type or a settings store, refactor it in its origin project to accept that as a parameter or interface, then move it here.

## Verification

```bash
pnpm install
pnpm type-check
pnpm test
```
