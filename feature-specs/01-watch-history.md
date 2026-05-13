# Feature Spec: Watch History & Change Timeline

## Overview

Track and display a chronological history of all detected changes for each watch, replacing the current single-snapshot model with a rolling log of diffs.

---

## Problem Statement

Currently, watches store a single snapshot and compare against live content. When a change is detected, the user sees the diff once. If they re-snapshot, the previous diff is lost forever. Users monitoring dynamic pages (stock tickers, dashboards, status pages) have no way to see *what changed over time* — only what's different right now.

---

## User Stories

- As a user monitoring a product price, I want to see a timeline of all price changes so I can identify trends.
- As a user watching a status page, I want to know *when* the status changed and what it changed from/to.
- As a user who stepped away, I want to review changes that happened while I wasn't looking.

---

## UX Design

### Watch Inspector Enhancement

The existing Watch Inspector gains a new collapsible section: **▶ History (N changes)**

When expanded, it shows a reverse-chronological list of change entries:

```
┌──────────────────────────────────────────┐
│ ▼ History (3 changes)                    │
│                                          │
│  ┌─ 2m ago ──────────────────────────┐   │
│  │  299 → 301                        │   │
│  └───────────────────────────────────┘   │
│  ┌─ 5m ago ──────────────────────────┐   │
│  │  295 → 299                        │   │
│  └───────────────────────────────────┘   │
│  ┌─ 12m ago ─────────────────────────┐   │
│  │  290 → 295                        │   │
│  └───────────────────────────────────┘   │
│                                          │
│  [ Clear History ]                       │
└──────────────────────────────────────────┘
```

Each entry shows:
- Relative timestamp (same `Xm ago` format as snapshot age)
- Content diff (same red→green inline format already used)
- Style change chips (if applicable)

### History Limit

- Default: **50 entries** per watch
- Oldest entries auto-pruned when limit reached
- "Clear History" button at bottom of history section

### Settings Integration

New option in Settings under WATCHES section:
```
📜 Change History     Enabled
   Keep a log of detected changes
```

Toggle to enable/disable history recording globally.

---

## User Behaviors

| Behavior | Expected Response |
|----------|-------------------|
| Change detected while history enabled | New entry prepended to history array |
| User re-snapshots | Re-snapshot does NOT clear history; adds a "manual re-snapshot" entry |
| User removes a watch | History for that watch is deleted |
| History exceeds 50 entries | Oldest entry silently removed |
| User disables history | Existing history preserved but no new entries recorded |
| User clears history | Confirmation toast, array emptied |
| Page reload | History persists via GM_setValue (stored with watch data) |

---

## Technical Notes

### Data Model Change

Current watch structure:
```javascript
{
  selector: '#counter',
  mode: 'content',
  snapshot: { content: '299', styles: {}, timestamp: 1712793600000 }
}
```

Proposed addition:
```javascript
{
  selector: '#counter',
  mode: 'content',
  snapshot: { content: '301', styles: {}, timestamp: 1712793720000 },
  history: [
    { from: '299', to: '301', timestamp: 1712793720000, type: 'content' },
    { from: '295', to: '299', timestamp: 1712793420000, type: 'content' },
    // ...
  ]
}
```

### Storage Considerations

- GM_setValue has no hard size limit in Tampermonkey (uses IndexedDB internally)
- However, storing large histories for body-level watches could bloat storage
- Mitigation: truncate stored diff strings to 200 chars each (with `…` suffix)
- Estimated storage per entry: ~300 bytes (timestamps + truncated diffs)
- 50 entries × 5 watches = ~75KB — well within reasonable limits

### Key Implementation Points

1. **Append in `checkForChanges()`**: When a change is detected and `historyEnabled`, push a new entry to `watch.history` before updating the snapshot.
2. **Prune on insert**: `if (watch.history.length > MAX_HISTORY) watch.history.pop();`
3. **Render in `openWatchInspector()`**: Add a new collapsible section after Content/Styling sections.
4. **Reuse existing diff rendering**: The red→green inline diff code and style chips code can be extracted into shared helpers.
5. **New storage key**: `GM_getValue('ar_history_enabled', true)` — defaults to enabled.

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| Storage bloat from large diffs | Medium | Truncate to 200 chars per entry |
| Performance with many history entries | Low | Lazy-render only visible entries; cap at 50 |
| History lost on watch re-add | Low | History is per-selector; different watch = different history |
