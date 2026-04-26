# CURB Caching Policy

## Purpose

This document defines the intended caching behavior across the CURB app so performance optimizations do not create stale-data confusion.

Core UX guarantee:

- Normal navigation may use cached data for speed.
- User-triggered Refresh must fetch fresh data end-to-end.

## Cache Layers

1. Browser local path cache

- File: js/cache.js
- Stores path-scoped folder and file results in localStorage.
- Stale threshold:
  - Root path (/): 2 hours
  - Non-root paths: 30 minutes
- Hard expiry:
  - Root path (/): 24 hours
  - Non-root paths: 6 hours

2. Service worker runtime caches

- File: sw.js
- Separate buckets:
  - App shell cache (precache)
  - Runtime cache (css/js/assets/html runtime responses)
  - API cache (requests under /api/)
- API strategy: network first with cache fallback.
- Static assets strategy: stale-while-revalidate.

3. Serverless in-memory caches

- api/browse.js: path cache, TTL 30 minutes
- api/coverage.js: coverage cache, TTL 5 minutes
- api/team.js: parsed sheet cache, TTL 24 hours

4. CDN/edge cache headers

- browse: public, s-maxage=1800, stale-while-revalidate=3600
- coverage: public, s-maxage=300, stale-while-revalidate=600
- team: public, s-maxage=3600, stale-while-revalidate=86400

## Force Refresh Contract

Force refresh is represented by query param refresh=1 (or force=1).

When force refresh is requested:

1. Client request uses cache: no-store where applicable.
2. Server bypasses in-memory cache.
3. Server responds with Cache-Control: no-store, no-cache, must-revalidate.
4. Endpoint may expose X-Cache: BYPASS for diagnostics.

## Endpoint Policy Matrix

### /api/browse

Normal mode:

- Uses server in-memory cache and edge cache headers.

Force mode:

- Bypasses server in-memory cache.
- Returns no-store response headers.

Used by:

- Home, levels, semesters, sessions, files, and track department list.

### /api/team

Normal mode:

- Uses parsed sheet cache + edge cache headers.

Force mode:

- Bypasses parsed sheet cache.
- Returns no-store response headers.

Used by:

- About page and track session source list.

### /api/coverage

Normal mode:

- Uses 5-minute in-memory cache + edge cache headers.

Force mode:

- Bypasses in-memory coverage cache.
- Returns no-store response headers.

Used by:

- Track page department accordion scans.

## Route-Level Refresh Expectations

1. Home

- Invalidates root local path cache and re-renders with force mode.

2. Levels / Semesters / Sessions / Files

- Invalidates current route path cache and re-renders with force mode.

3. About

- Re-renders with force mode (team data fetched with refresh=1).

4. Track

- Re-renders with force mode.
- Team and browse list fetches use force mode.
- Coverage scan fetches use force mode for that render context.

## Guardrails

1. Do not add a new cache layer for the same data without documenting:

- owner layer
- stale threshold
- hard expiry
- force-refresh bypass path

2. Any new API endpoint with caching must support force refresh.

3. Any user-visible Refresh action must call force mode through to the endpoint.

4. Keep comments aligned with real TTL values in code.

## Verification Checklist

When changing caching behavior, verify:

1. Normal navigation is fast and does not regress.
2. Refresh triggers fresh server fetch (not stale cache replay).
3. Offline fallback still works for app shell and last-known API responses.
4. Existing tests pass.
5. Any new caching semantics are reflected in this file.

## Known Tradeoffs

1. Network-first API strategy can still fall back to cached responses when offline.
2. Different layers may still cache in normal mode by design for performance.
3. Force refresh is the explicit escape hatch for freshness.

## Change Log Notes

- Added force-refresh support to browse and coverage APIs.
- Wired route refresh to propagate force mode through renderers and data fetches.
- Split service worker cache buckets into app shell, runtime, and API.
- Fixed path-aware staleness reporting for root path entries in cache diagnostics.
