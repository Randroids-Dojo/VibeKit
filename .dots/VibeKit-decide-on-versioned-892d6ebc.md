---
title: Decide on versioned-storage variant or stay flat
status: open
priority: 4
issue-type: task
created-at: "2026-05-09T15:10:55.322802-05:00"
---

VibeGear2/src/persistence/save.ts has heavy versioning, schema migration on read, backup-on-corruption, cross-tab writeCounter, reloadIfNewer. VibeKit's storage.ts is flat readStorage/writeStorage/updateStorage/listenStorage. Decide: (a) keep flat (game-side migration code lives in projects), (b) ship a second module (versioned-storage) with a migrations array contract, (c) extend the existing module with optional version+migrations options. Versioned save data is common across game projects; this likely deserves a kit-level abstraction.
