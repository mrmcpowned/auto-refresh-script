# Feature Spec: Watch Overview

## Overview

A cross-page watch manager that lets users view all watches on the current domain and all watches across every domain — from a single modal. Currently, watches are scoped per-page and only visible when visiting that exact page. This feature surfaces all watches in one place, grouped by domain and page, with the ability to navigate to a watch's page or remove it remotely.

---

## Problem Statement

Watches are stored per-page using `autoRefreshWatches_<origin+pathname>` storage keys. Users have no way to:

1. See how many watches exist on other pages of the current site
2. View or manage watches they created on pages they aren't currently visiting
3. Get a global inventory of all watches across all domains
4. Clean up stale watches on pages they no longer visit

The only way to manage a watch is to navigate to the exact page where it was created and open the settings modal. For users with many watches across many sites, this makes watch management impractical.

---

## User Stories

- As a user monitoring multiple pages on a site, I want to see all watches on the current domain so I can understand my monitoring coverage without visiting every page.
- As a power user with many watches, I want a global view of all watches across all domains so I can audit what I'm tracking.
- As a user cleaning up old watches, I want to remove watches from pages I'm not currently visiting so I don't have to navigate to each page individually.
- As a user, I want to see which page each watch belongs to so I can navigate there if I need to inspect or re-snapshot it.
- As a user, I want to see at a glance how many watches I have per domain and per page so I can manage complexity.

---

## UX Design

### Entry Point — Settings Modal

A new button in the WATCHES section of the settings modal, placed between "Add Watch" and "Inspect Watches":

```
┌──────────────────────────────────────────┐
│  WATCHES (2)                             │
│  ┌────────────────────────────────────┐  │
│  │ 👁 Add Watch                       │  │
│  │   Pick an element to monitor       │  │
│  ├────────────────────────────────────┤  │
│  │ 🌐 Watch Overview           12     │  │
│  │   All watches across pages         │  │
│  ├────────────────────────────────────┤  │
│  │ 🔍 Inspect Watches           2     │  │
│  │   View stored vs live content      │  │
│  ├────────────────────────────────────┤  │
│  │ 🗑 Remove Watches            2     │  │
│  │   Remove individual or all         │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
```

The value badge shows the **total** watch count across all pages/domains (not just the current page). This button is always visible — even when the current page has 0 local watches — so users can manage watches from any page.

### Watch Overview Modal — Domain View (Default)

On open, the modal shows domains grouped with watch counts. The current domain is listed first and visually highlighted.

```
┌──────────────────────────────────────────┐
│  ← Watch Overview                        │
│    All watches across pages              │
│                                          │
│    ┌─ View ──────────────────────────┐   │
│    │ ● This Domain  ○ All Domains    │   │
│    └─────────────────────────────────┘   │
│                                          │
│  DEVELOPER.MOZILLA.ORG (5)               │
│  ┌────────────────────────────────────┐  │
│  │ /en-US/                       2    │  │
│  │ /en-US/docs/Web/CSS           1    │  │
│  │ /en-US/docs/Web/HTML          2    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  🗑 Remove All Domain Watches            │
│                                          │
│                           12 total       │
└──────────────────────────────────────────┘
```

**"All Domains" toggle** switches to a multi-domain view:

```
┌──────────────────────────────────────────┐
│  ← Watch Overview                        │
│    All watches across pages              │
│                                          │
│    ┌─ View ──────────────────────────┐   │
│    │ ○ This Domain  ● All Domains    │   │
│    └─────────────────────────────────┘   │
│                                          │
│  DEVELOPER.MOZILLA.ORG (5)               │
│  ┌────────────────────────────────────┐  │
│  │ /en-US/                       2    │  │
│  │ /en-US/docs/Web/CSS           1    │  │
│  │ /en-US/docs/Web/HTML          2    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  EXAMPLE.COM (3)                         │
│  ┌────────────────────────────────────┐  │
│  │ /                             1    │  │
│  │ /products                     2    │  │
│  └────────────────────────────────────┘  │
│                                          │
│  GITHUB.COM (4)                          │
│  ┌────────────────────────────────────┐  │
│  │ /user/repo                    3    │  │
│  │ /user/repo/issues             1    │  │
│  └────────────────────────────────────┘  │
│                                          │
│                           12 total       │
└──────────────────────────────────────────┘
```

### Page Detail — Reuse `watch-inspector`

Clicking a page row opens the existing **`watch-inspector`** modal, passing the page's watches via `ctx.extra`. The watch-inspector already provides:

- **Sidebar** listing watches with status dots and selectors
- **Detail pane** showing stored vs live content
- **Re-snapshot** and **delete** buttons

The only adaptation needed is making `watch-inspector` accept an external watch list instead of always calling `getWatches()`:

```javascript
// watch-inspector build function change:
const watches = ctx.extra?.watches || getWatches();
```

**For watches on the current page** — full existing behavior: stored vs live comparison, re-snapshot, delete.

**For watches on other pages** — the live content pane shows an `ar-empty-state` message: "Navigate to this page to see live content". The re-snapshot button is disabled (grayed out). Delete still works via `removeRemoteWatch()`. An "Open Page" button is added to navigate to the watch's URL.

```
┌──────────────────────────────────────────┐
│  ← Inspect Watches                       │
│    /en-US/ · developer.mozilla.org       │
│                                          │
│  ┌──────┐ ┌──────────────────────────┐   │
│  │●sel1 │ │ STORED CONTENT           │   │
│  │●sel2 │ │ ┌──────────────────────┐ │   │
│  │      │ │ │ MDN Web Docs         │ │   │
│  │      │ │ └──────────────────────┘ │   │
│  │      │ │                          │   │
│  │      │ │ LIVE CONTENT             │   │
│  │      │ │ ┌──────────────────────┐ │   │
│  │      │ │ │ Navigate to this     │ │   │
│  │      │ │ │ page to see live     │ │   │
│  │      │ │ │ content              │ │   │
│  │      │ │ └──────────────────────┘ │   │
│  │      │ │                          │   │
│  │      │ │ 🔗 Open Page  🗑 Delete  │   │
│  └──────┘ └──────────────────────────┘   │
└──────────────────────────────────────────┘
```

The overview modal also adds footer actions per page row:

- **🔗 Open Page**: `window.open(url, '_blank')`
- **🗑 Remove All**: Removes all watches for that page (with confirmation toast)

### Settings Integration

No new persistent settings. The "This Domain" / "All Domains" toggle is modal-local state (defaults to "This Domain" on each open).

---

## Technical Design

### Data Discovery — `GM_listValues()`

The key enabler is **`GM_listValues()`** — a Tampermonkey API that returns all stored key names. This is not currently granted and must be added:

```javascript
// @grant        GM_listValues
```

A new function scans for all watch storage keys:

```javascript
function getAllWatches() {
    const allKeys = GM_listValues();
    const watchKeys = allKeys.filter(k => k.startsWith('autoRefreshWatches_'));
    const result = [];

    for (const key of watchKeys) {
        try {
            const watches = JSON.parse(GM_getValue(key, '[]'));
            if (!Array.isArray(watches) || watches.length === 0) continue;
            // Extract URL from the key: 'autoRefreshWatches_' is 19 chars
            const urlKey = key.slice(19);
            for (const w of watches) {
                result.push({ ...w, _storageKey: key, _urlKey: urlKey });
            }
        } catch { /* skip corrupt entries */ }
    }

    return result;
}
```

### Grouping Logic

```javascript
function groupWatchesByDomain(watches) {
    const groups = {};
    for (const w of watches) {
        let origin, pathname;
        try {
            const url = new URL(w.url || w._urlKey);
            origin = url.origin;
            pathname = url.pathname;
        } catch {
            origin = 'unknown';
            pathname = w.url || w._urlKey;
        }
        const domain = origin.replace(/^https?:\/\//, '');
        if (!groups[domain]) groups[domain] = { origin, pages: {} };
        if (!groups[domain].pages[pathname]) groups[domain].pages[pathname] = [];
        groups[domain].pages[pathname].push(w);
    }
    return groups;
}
```

The current domain (`location.hostname`) is sorted first. Within each domain, pages are sorted alphabetically by pathname.

### Remote Watch Removal

Removing a watch from a different page requires writing to that page's storage key directly:

```javascript
function removeRemoteWatch(watch) {
    const key = watch._storageKey;
    try {
        const watches = JSON.parse(GM_getValue(key, '[]'));
        const filtered = watches.filter(w => w.id !== watch.id);
        GM_setValue(key, JSON.stringify(filtered));
    } catch { /* skip */ }
}
```

This bypasses the local `_watchCache` since the watch belongs to a different page's storage.

### Relative Time Formatting

A small helper to display snapshot age:

```javascript
function _relativeTime(ms) {
    const seconds = Math.floor((Date.now() - ms) / 1000);
    if (seconds < 60) return 'just now';
    if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
    if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
    return Math.floor(seconds / 86400) + 'd ago';
}
```

### Modal Definitions

One new modal + one adapted existing modal:

1. **`watch-overview`** (NEW) — Domain/page list with "This Domain" / "All Domains" toggle. Clicking a page row calls `ctx.push('watch-inspector', { watches, pageUrl, storageKey })`
2. **`watch-inspector`** (ADAPTED) — Accepts optional `ctx.extra.watches` array instead of always using `getWatches()`. When watches are from another page, disables re-snapshot and shows "Navigate to this page to see live content" in the live pane. Adds "Open Page" button when `ctx.extra.pageUrl` differs from `_pageUrl()`.

Both follow the existing `Modal.define()` + `Modal.push()` pattern.

### Integration Points

- **Settings modal (WATCHES section)**: New "🌐 Watch Overview" button that calls `ctx.push('watch-overview')`
- **`GM_listValues`**: New grant in userscript header
- **`removeRemoteWatch()`**: New function for cross-page watch deletion. Does NOT affect local `_watchCache` unless the watch is on the current page (in which case, fall through to existing `removeWatch()`)
- **`watch-inspector` modal**: Adapted to accept external watch list via `ctx.extra.watches`, disable re-snapshot for remote watches, show placeholder for live content on remote pages, and add "Open Page" button
- **`addWatch()` / `removeWatch()`**: Unchanged — local watch operations remain scoped to current page
- **`_truncate()`**: Reused for selector display
- **`showToast()`**: Reused for removal confirmations

---

## Edge Cases & Error Handling

- **No watches anywhere**: Show `ar-empty-state` message: "No watches found on any page"
- **Corrupt storage keys**: `getAllWatches()` catches parse errors per-key and skips corrupt entries
- **Legacy watches without `.url`**: These were migrated in `getWatches()` already, but `getAllWatches()` should handle missing URLs gracefully (derive from the storage key suffix)
- **Current page cache invalidation**: If a user removes a watch for the current page via the overview modal, the local `_watchCache` must be cleared so subsequent reads reflect the change
- **Large number of watches**: Render is static (not virtualized). Reasonable limit is ~100 watches; beyond that, scrolling may slow. Not worth optimizing for v1 — revisit if users report issues
- **"Open Page" navigation**: Uses `window.open(url, '_blank')` so the current page isn't disrupted. The URL is reconstructed from `watch.url` (which is `origin + pathname`)
- **Domain with many pages**: Pages within a domain are listed alphabetically; no collapse/expand for v1

---

## Scope & Non-Goals

### In Scope
- `GM_listValues()` discovery of all watch storage keys
- Domain grouping and page grouping
- "This Domain" / "All Domains" toggle
- Drill-down into page watches via reused `watch-inspector` modal
- Stored content inspection for watches on any page (text and style snapshots)
- Live vs stored comparison when on the same page (existing watch-inspector behavior)
- Remote watch removal (delete watches from pages you're not on)
- Watch count badge on the overview button
- "Open Page" link to navigate to a watch's page
- "Remove All" per page
- Relative time display for snapshot age

### Out of Scope (Future)
- Bulk operations across multiple domains (e.g., "Remove All Watches Everywhere")
- Search/filter in the overview
- Re-snapshotting remote watches (requires being on the page to access live DOM)
- Exporting/importing watches (covered by spec #06)
- Watch history or change log (covered by spec #01)

---

## Risks & Open Questions

1. **`GM_listValues()` availability**: This API is supported in Tampermonkey, Violentmonkey, and Greasemonkey 4+. It should be widely available, but the spec should note the new grant requirement.
2. **Storage key format coupling**: `getAllWatches()` depends on the `autoRefreshWatches_` prefix. If the prefix changes, discovery breaks. This is acceptable since the prefix is a hardcoded constant.
3. **Performance with many storage keys**: `GM_listValues()` returns all keys (not just watch keys). On a userscript with many stored values, filtering is O(n) on key count — negligible.
4. **"Remove All Domain Watches" danger**: Should this require a confirmation step? Recommendation: yes — use a confirm toast or inline "Are you sure?" before deleting all watches for a domain.

---

## Implementation Details

**Version**: 2.1.0
**Date**: 2026-04-12
**Action Plan**: [action-plans/watch-overview.md](../action-plans/watch-overview.md)

### What Was Built
- `getAllWatches()` function that scans all GM storage keys via `GM_listValues()`, filters for `autoRefreshWatches_*`, and returns annotated watch objects with `_storageKey` and `_urlKey` metadata. Includes legacy watch migration (adds missing `id` and `url`).
- `groupWatchesByDomain(watches)` function that groups watches by domain (extracted from URL), then by pathname. Current domain is sorted first.
- `removeRemoteWatch(watch)` function for cross-page watch deletion via direct storage key manipulation. Invalidates local `_watchCache` if the watch is on the current page.
- `watch-overview` modal with "This Domain" / "All Domains" toggle, domain sections with watch counts, page rows with status dots and mode labels, "Remove all \<domain\> watches" with 5-second two-click confirmation, and total footer.
- Adapted `watch-inspector` modal to accept external watches via `ctx.extra.watches`, show stored content for remote watches, disable re-snapshot for remote pages, display "Navigate to this page to see live content" placeholder, and add "Open Page" button.
- MutationObserver on the overview's overlay to detect re-show events and refresh data when returning from sub-modals.
- "📋 Watch Overview" button in settings WATCHES section (always visible) with total watch count badge.

### Deviations from Spec
- Used existing `timeAgo()` function instead of creating a new `_relativeTime()` helper
- Added legacy watch migration in `getAllWatches()` — assigns `id` and `url` to watches lacking them so `removeRemoteWatch` can match by ID
- Added MutationObserver-based data refresh on the overview modal to handle stale state after sub-modal interactions
- When deleting the last remote watch, the inspector pops back to a fresh overview via `Modal.pop(); Modal.pop(); Modal.push('watch-overview')`
- URL parsing uses `raw.startsWith('http')` guard to avoid double-protocol (`https://https://...`) for URLs already containing the scheme
- Entry point button uses 📋 emoji instead of 🌐 (which was already used for Webhook)

### Code Location
| Component | Location |
|-----------|----------|
| `getAllWatches()` | Line ~213 |
| `groupWatchesByDomain()` | Line ~237 |
| `removeRemoteWatch()` | Line ~256 |
| `watch-overview` modal | Line ~2525 |
| `watch-inspector` adaptations | Line ~2237 (isRemote logic) |
| Settings "Watch Overview" button | Line ~2213 |
| `GM_listValues` grant | Line 12 |

### Testing Notes
- All QA scenarios passed: This Domain view, All Domains view, page drill-down (local and remote), individual and bulk deletion, back navigation, fresh data on return from sub-modals
- "Remove All Domain Watches" uses a 5-second two-click confirmation pattern
- Settings badge shows stale count after deletions in the overview (refreshes on next settings open) — this is consistent with all other stale-on-pop behaviors in the modal framework
- No console errors observed during testing

### Screenshots
- [Settings with Watch Overview button](images/29-settings-watch-overview-button.png)
- [Watch Overview - This Domain](images/29-overview-this-domain.png)
- [Watch Overview - All Domains](images/29-overview-all-domains.png)
- [Remote Watch Inspector](images/29-remote-watch-inspector.png)
