# Changelog

## [0.2.0](https://github.com/Randroids-Dojo/VibeKit/compare/v0.1.0...v0.2.0) (2026-05-09)


### Features

* **rng:** add Rng object form with split, serialize, and deserialize ([375bcd1](https://github.com/Randroids-Dojo/VibeKit/commit/375bcd1de7d414d8b0c30324a4a25d78b0a3002c))
* **server/kv:** add KvLike interface + adaptUpstashRedis adapter ([276bb49](https://github.com/Randroids-Dojo/VibeKit/commit/276bb49e22440b3825719a7955c847ca2cfb52f1))

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
