# Implementation Plan: Watch Overview (Feature #29)

## Version Target: 2.1.0

## Overview
Add a cross-page/cross-domain watch manager that discovers all watch storage keys via `GM_listValues()`, groups them by domain and page, and lets users inspect stored content via the existing `watch-inspector` modal. Entry point is a new "Watch Overview" button in the settings WATCHES section.

## Implementation Steps

### Step 1: Add GM_listValues grant
**Location**: Line 11 (after last @grant)
- Add `// @grant        GM_listValues`

### Step 2: Add `getAllWatches()` and `groupWatchesByDomain()` helpers
**Location**: After `removeWatch()` (line ~211), before `captureStyles()`
- `getAllWatches()`: Iterates `GM_listValues()`, filters for `autoRefreshWatches_` prefix, parses each, annotates watches with `_storageKey` and `_urlKey`
- `groupWatchesByDomain(watches)`: Groups by domain (from `w.url`), then by pathname. Current domain sorted first.

### Step 3: Add `removeRemoteWatch(watch)` helper
**Location**: After `getAllWatches()`
- Reads the remote storage key, filters out the watch by id, saves back
- If the watch is on the current page, also invalidates `_watchCache`

### Step 4: Define `watch-overview` modal
**Location**: After `watch-inspector` Modal.define (line ~2402)
- "This Domain" / "All Domains" toggle (radio-style buttons)
- Groups watches by domain, then by page path
- Each page row is a button showing pathname + watch count
- Clicking a page row pushes `watch-inspector` with `{ watches, pageUrl, storageKey }`
- "Remove All Domain Watches" button in domain view (with confirmation)
- Total watch count in footer

### Step 5: Adapt `watch-inspector` to accept external watches
**Location**: Lines 2187-2402 (watch-inspector Modal.define)
- Change `let watches = getWatches();` to `let watches = (ctx.extra && ctx.extra.watches) || getWatches();`
- Track `isRemote = ctx.extra && ctx.extra.pageUrl && ctx.extra.pageUrl !== _pageUrl()`
- When `isRemote`: disable re-snapshot button, show "Navigate to page to see live content" placeholder in content/style sections, add "Open Page" button
- When remote watch deleted, call `removeRemoteWatch()` instead of `removeWatch()`

### Step 6: Add Watch Overview button in settings
**Location**: After "Add Watch" button at line ~2159
- Always visible (even with 0 local watches)
- Badge shows total watch count across all pages/domains
- Calls `ctx.push('watch-overview')`

### Step 7: Syntax check
- Run `node -c auto-refresh.user.js`

## Key Design Decisions
- **Reuse `watch-inspector`** instead of a custom page detail modal — less code, consistent UX
- **`GM_listValues()`** for storage key discovery — no index/registry needed
- **Remote watches show stored content only** — live comparison requires being on the page
- **"This Domain" default** — most useful view when managing watches on a specific site
- **No new CSS classes needed** — reuse existing `ar-btn`, `ar-section-hdr`, `ar-empty-state`, `ar-toggle-row`, `ar-subtitle-sm`, `ar-dot`, `ar-truncate`

## Testing Plan
1. **No watches anywhere**: Button shows total "0", overview shows empty state
2. **Local watches only**: This Domain shows current page watches, clicking inspects them normally
3. **Cross-page watches**: Create watches on multiple pages (e.g., example.com, MDN), verify all appear in "All Domains" view
4. **Page drill-down**: Clicking a page row opens watch-inspector with correct watches
5. **Remote inspection**: For watches on other pages, stored content visible, live pane shows placeholder, re-snapshot disabled
6. **Remote deletion**: Delete a remote watch, verify it's removed from storage
7. **"Open Page" button**: Navigates to the watch's URL in new tab
8. **"Remove All" per page**: Confirmation + removal of all watches for a page
9. **Back navigation**: Back from watch-inspector returns to watch-overview
10. **Settings re-render**: After deleting watches via overview, settings watchCount updates

## Deviations from Spec

1. **URL parsing fix**: `groupWatchesByDomain()` needed `raw.startsWith('http')` check before prepending `https://` to avoid `https://https://...` double-protocol for URLs already containing the scheme.
2. **Legacy watch migration in `getAllWatches()`**: Added migration (assign `id` and `url` to watches missing them) so `removeRemoteWatch()` can match by ID.
3. **MutationObserver for stale data**: Added a MutationObserver on the overview modal's overlay to detect when it becomes visible again after a sub-modal pops, triggering a `refreshData()` + `renderList()`.
4. **Inspector delete with fresh overview**: When deleting the last remote watch in the inspector, `Modal.pop(); Modal.pop(); Modal.push('watch-overview')` replaces the stale overview with a fresh one.
5. **Confirm timeout**: Set to 5 seconds for the "Remove all domain watches" button (spec didn't specify timeout duration).
6. **No `_relativeTime()` helper**: Reused existing `timeAgo()` function already in the codebase.

## Status: COMPLETED
**Version**: 2.1.0
**Date**: 2026-04-12
