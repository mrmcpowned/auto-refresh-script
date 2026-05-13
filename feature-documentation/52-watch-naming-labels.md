# Feature Spec: Watch Naming / Labels

## Overview

Allow users to assign a custom friendly name to each watch (e.g., "Amazon Price", "Job Board Listings") that is displayed in the Watch Overview, Watch Inspector sidebar, context menu, clear-watch modal, and badge hover tooltip instead of the raw CSS selector.

---

## Problem Statement

Watches are currently identified by their CSS selector (e.g., `div.price-block > span.a-price`), which is often cryptic, auto-generated, and too long to display meaningfully. Users monitoring multiple elements across multiple pages have difficulty distinguishing watches at a glance. A human-readable label would make watch management significantly easier.

---

## User Stories

- As a user with 5+ watches, I want to name them ("Amazon Price", "Stock Count") so I can quickly identify each in the overview.
- As a user who just picked an element, I want an optional name field in the watch-mode modal so I can label it immediately.
- As a user looking at the inspector, I want to see my custom label instead of a truncated CSS selector in the sidebar.
- As a user who didn't set a name, I want the selector to still display as a fallback — naming should be optional.

---

## UX Design

### Watch Mode Modal (after element pick)

Add an optional name input between the selector preview and the mode buttons:

```
┌──────────────────────────────────┐
│ ← Back                          │
│ What to watch?                   │
│ Choose what changes to monitor   │
│ ┌──────────────────────────────┐ │
│ │ div.price > span.amount      │ │
│ └──────────────────────────────┘ │
│ ┌──────────────────────────────┐ │
│ │ Name (optional): Amazon Price│ │
│ └──────────────────────────────┘ │
│ 📝 Text Content                 │
│ 🎨 Styling                      │
│ 📝🎨 Both                       │
└──────────────────────────────────┘
```

### Watch Overview

Display name (or truncated selector if no name) in the watch rows:

```
│ ● Amazon Price           content │
│ ● div.stock-count        style   │
```

### Watch Inspector Sidebar

Show name as primary text, selector as secondary:

```
│ Amazon Price    │
│ div.stock-count │
```

### Context Menu (Ctrl+Right-click)

Show name in the header if the watch has one:

```
┌────────────────────┐
│ 👁 Amazon Price    │
│ div.price > span   │
└────────────────────┘
```

### Badge Hover Tooltip

No change — hover already shows watch count, not individual names.

### Settings Integration

No new Config keys. The name is stored per-watch in the watch data model.

---

## Technical Design

### Data Model

Add optional `label` field to watch objects:

```javascript
{
    id: 'w_abc123',
    selector: 'div.price > span',
    mode: 'content',
    content: '$29.99',
    styles: '',
    snapshotTime: 1713100000000,
    url: 'https://example.com/product',
    label: 'Amazon Price'  // NEW — optional, defaults to ''
}
```

### Display Helper

Add a helper function:

```javascript
function watchDisplayName(w) {
    return w.label || _truncate(w.selector);
}
```

Use `watchDisplayName(w)` everywhere a watch is displayed in UI: overview rows, inspector sidebar, clear-watch buttons, context menu header, toast messages.

### Watch Mode Modal Changes

In the `watch-mode` modal `build()` function:
1. Add an `ar-input` text field after the selector preview, before mode buttons
2. Placeholder: "Name (optional)"
3. Store the value in a local variable, pass it into the watch object on mode selection
4. Empty string = no label (fallback to selector)

### Migration

No migration needed — existing watches without `label` will use the selector fallback via `watchDisplayName()`.

### I18N Keys

```
'watch.nameOptional':    'Name (optional)'
'watch.namePlaceholder': 'e.g., Amazon Price'
```

### Integration Points

- Watch mode modal: add input field
- `watchDisplayName()`: new helper used by ~6 UI surfaces
- Watch Inspector sidebar: show label as primary, selector as tooltip
- Clear-watch modal: show label in button text
- Context menu: show label in header
- Watch overview: show label in row text
- Toast messages: use label in `toast.watchRemovedSel` when available

---

## Edge Cases & Error Handling

- Empty label: treated as "no label" — falls back to truncated selector
- Very long labels: truncated via `_truncate()` at display sites (30 chars default)
- Duplicate labels across watches: allowed — labels are display-only, not identifiers
- Label with special characters: safe because we use `text:` (not `html:`) in `h()`
- Re-snapshot: label is preserved (only content/styles/snapshotTime are updated)

---

## Scope & Non-Goals

### In Scope
- Optional `label` field on watch objects
- Input in watch-mode modal for setting the name
- `watchDisplayName()` helper
- Update all 6+ display surfaces to prefer label over selector
- I18N for label-related strings

### Out of Scope (Future)
- Renaming an existing watch after creation (edit label)
- Auto-generating labels from element content (e.g., using the first few words)
- Label-based search/filter in watch overview

---

## Risks & Open Questions

1. Should users be able to edit the label after creation? Deferred — can be added as a toolbar button in the inspector later.
2. Should the label be part of the deduplication key? No — deduplication remains by selector + URL.

---

## Implementation Details

**Version**: 4.2.0
**Date**: 2026-04-14
**Action Plan**: [action-plans/features-48-52.md](../action-plans/features-48-52.md)

### What Was Built
- Optional `label` field on watch objects, stored per-watch
- `watchDisplayName(w, max)` helper function: returns label or truncated selector
- Name input in watch-mode modal (after element pick, before mode buttons)
- Updated 6 display surfaces to prefer label over selector:
  - Watch inspector sidebar
  - Clear-watch modal
  - Context menu header
  - Watch overview subtitle
  - Toast messages (via displayName variable)
- No migration needed: existing watches without `label` fall back to selector

### Deviations from Spec
- Watch overview shows labels in the page-row subtitle (not individual watch rows, since overview groups by page)

### Code Location
| Component | Location |
|-----------|----------|
| `watchDisplayName()` | Line ~1866 |
| I18N keys (watch.*) | Lines 599-600 |
| Watch-mode name input | Lines 3182-3188 |
| Inspector sidebar label | Line ~3495 |
| Clear-watch label | Line ~3099 |
| Context menu label | Lines 3998-4000 |

### Testing Notes
- Verified: naming a watch `Featured Article'' shows label in inspector sidebar
- Verified: clear-watch modal shows label instead of CSS selector
- Verified: context menu shows custom label in header
- Verified: unnamed watches fall back to truncated selector
- Zero console errors

