---
title: Widen server/kv to support hset/hgetall/zadd/zrange (Upstash Redis hash + sorted-set surface)
status: closed
priority: 2
issue-type: task
created-at: "\"2026-05-09T15:10:47.457108-05:00\""
closed-at: "2026-05-09T16:55:21.957269-05:00"
close-reason: shipped in v0.2.0 (276bb49)
---

VibeGear2/src/leaderboard/store-upstash-redis.ts uses hset, hgetall, zadd, zrange beyond v0.1.0's get/set/del. Add a thin wrapper for these on the cached singleton or expose the underlying Upstash Redis instance via getKv with typed helpers. Required to land VibeGear2's leaderboard migration dot. Decide: passthrough vs typed wrapper. Watch for env shape (KV_REST_API_URL/TOKEN already covered).
