---
title: Lift VibeGear2 RNG superset to @randroids-dojo/vibekit/rng
status: closed
priority: 2
issue-type: task
created-at: "\"2026-05-09T15:10:39.757692-05:00\""
closed-at: "2026-05-09T16:55:21.953640-05:00"
close-reason: shipped in v0.2.0 (375bcd1)
---

VibeGear2/src/game/rng.ts is the superset: Rng interface (stateful), createRng, splitRng, serializeRng, deserializeRng, nextInt, nextBool, plus FNV-1a label hashing for replay determinism. VibeKit's current rng.ts only has makeRng, range, pick, gauss. Lifting these gives every consumer reproducible replays and split-state determinism. Cut as v0.2.0 (or v0.1.1 under bump-patch-for-minor-pre-major). Keep makeRng/range/pick/gauss API stable so VibeRacer adoption does not break.
