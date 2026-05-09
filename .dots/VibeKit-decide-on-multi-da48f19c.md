---
title: Decide on multi-touch zone joystick variant in VibeKit
status: open
priority: 4
issue-type: task
created-at: "2026-05-09T15:10:51.159739-05:00"
---

VibeGear2/src/game/inputTouch.ts is a split-zone multi-touch handler (steer zone, throttle/brake circles, nitro/pause corners, blur-reset, layout-driven). VibeKit's virtual-joystick.ts is a single thumb stick. Decide: (a) keep them separate (project-specific UX), (b) ship a second module (multi-touch-zone-input) alongside the single stick, (c) generalize the existing module with zones config. Talk to VibeGear2 first since it is the only consumer needing this today.
