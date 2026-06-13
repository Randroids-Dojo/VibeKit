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

### `swipe-gesture`

Pure tap / upward-swipe classifier for canvas and touch games. `classifySwipeGesture(start, end, bounds, config?)` returns `tap`, `up-swipe`, or `none` plus `dragPowerNorm` and `lateralAngle`; `dragPowerNorm(start, current, bounds, config?)` gives the same power value for live previews.

### `audio-context`

Web Audio lifecycle helpers shared by every project that synthesizes sound. `getAudioContext()` lazily creates and caches one `AudioContext` (with a `webkitAudioContext` fallback) and returns `null` when the Web Audio API is unavailable (SSR / headless / old browser). `resumeAudioContext()` creates-and-resumes from the first user gesture, since browsers start contexts suspended. `closeAudioContext()` tears it down and drops the reference; `resetAudioContextForTesting()` clears state without closing. Scope is deliberately just the context lifecycle: the synthesis graph and any master / bus routing stay in the consumer, since projects still diverge on shared-context versus per-layer-context shapes.

## Server modules — `@randroid/game-kit/server`

Server-only helpers that import `@upstash/redis` and `node:crypto`. Import path is the `./server` subpath, never the root, so a stray client import errors loudly:

```ts
import { getKv, readKv, writeKv, signToken, verifyToken, incrementWithExpiry } from '@randroid/game-kit/server'
```

### `getKv()` and `readKv` / `writeKv` / `removeKv`

`getKv()` returns an `@upstash/redis` `Redis` client when either `KV_REST_API_URL` / `KV_REST_API_TOKEN` or `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` are populated, or `null` otherwise. Returning null lets routes degrade gracefully in local dev or preview deploys without a KV binding.

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

## Guidance for 3D consumers (z-fighting)

Several games on this kit render 3D scenes (VibeRacer, VibeCity, VibeGear2, the VibeCoded.Games arcade). The most common "looks broken" artifact in those scenes is z-fighting: two opaque surfaces that share a plane, or cross at a shallow grazing angle, shimmer along the seam because the depth buffer cannot order them.

The trap: **z-fighting is invisible in a still frame.** Parked, the depth ties resolve to one stable answer and the seam looks clean; it only flickers while the camera or geometry moves. A single screenshot is not a verification.

When modeling, never leave surfaces flush or grazing:

- Do not place a decal/sign/billboard face at the exact depth of the panel behind it, and do not sit a trim strip's face exactly on the surface it trims. Coplanar faces fight.
- Do not bury an accent box (bezel, marquee, header, badge, plinth) into a larger body so its face ends up nearly parallel to and nearly the same depth as the body's face, or so its tilted underside grazes a near-parallel body face. Mount accents **clearly proud** of the surface (a few cm), or **fully enclosed** inside it, never flush.
- Size the separation gap to the scene and camera, not a token `0.001`. Depth resolution falls off with distance (`d² / (near · (far − near))`); a gap safe at 1m fights at 40m. At room/hall scale, ~2-3cm is a safe floor.
- Set the camera `near` plane to the closest the player can actually reach (often `0.1`, not `0.01`); a tiny near plane wastes precision everywhere.

Verify in motion: pan or orbit the camera past every seam and watch it. A frozen-camera frame diff shows nothing even when the scene is full of z-fighting; diff consecutive frames *while the camera moves* instead. Verify from several angles too, not just head-on: a coplanar *side* seam (an accent box modeled at the parent's full width, so its side faces share the parent's side plane) is edge-on and invisible from the front, and only shows obliquely.
