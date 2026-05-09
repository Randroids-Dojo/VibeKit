# Changelog

## [0.1.0](https://github.com/Randroids-Dojo/VibeKit/releases/tag/v0.1.0) (2026-05-09)

Initial release of `@randroids-dojo/vibekit`.

### Features

* **virtual-joystick**: float-where-you-tap touch joystick state.
* **editor-history**: generic `EditorHistory<T>` undo / redo stack.
* **confetti**: pure particle simulation for celebration overlays.
* **rng**: seeded Mulberry32 PRNG plus `range`, `pick`, `gauss`.
* **math**: `TAU`, `clamp`, `lerp`, `inverseLerp`, `remap`, `smoothstep`, `wrapAngle`.
* **storage**: defensive zod-validated `localStorage` helpers with cross-tab + same-tab change events.
* **server/kv**: cached Upstash Redis singleton, `readKv<T>` zod-validated, `writeKv` with optional TTL, `removeKv`, `resetKvForTesting`.
* **server/sign**: HMAC-SHA256 `signToken` / `verifyToken` with constant-time comparison.
* **server/rate-limit**: `incrementWithExpiry` fixed-window primitive.

### Consumers

Sibling projects pin via `github:Randroids-Dojo/VibeKit#v0.1.0`.
