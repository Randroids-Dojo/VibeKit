---
title: Design and add the standard VibeKit audio API (master + buses)
status: open
priority: 3
issue-type: task
created-at: "2026-06-08T17:16:25.819655-05:00"
---

audio-context (PR #2) added only the shared AudioContext lifecycle (getAudioContext / resumeAudioContext / closeAudioContext + first-gesture resume). The broader reusable shape identified in the FrackingAsteroids audit (dot FrackingAsteroids-audit-src-game-6bdbd52e) is a standard audio API on top of it: a master gain bus, named sub-buses (e.g. sfx / music), a clamped per-bus volume model, and an agreed context lifecycle. That part was intentionally deferred because the consumers diverge: FrackingAsteroids routes each sound directly to destination and scales by a volume scalar, VibeRacer uses a shared engine plus buses, VibeCity uses per-feature audio rigs, and Flatline uses several per-layer contexts. Building the standard API requires converging those projects on one shape and depends on VibeRacer's decouple-audioEngine task landing first. Steps: cross-reference VibeRacer src/game/audioEngine.ts and the VibeCity / Flatline audio modules; design a master + bus + volume API layered on audio-context; ship it as a vibekit module with tests; then have the consumers adopt it (closes FrackingAsteroids follow-up F-002).
