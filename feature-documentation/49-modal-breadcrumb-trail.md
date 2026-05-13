# Feature Spec: Modal Breadcrumb Trail

## Overview

Add a breadcrumb navigation bar at the top of sub-modals showing the full navigation path (e.g., "Settings › Badge Style › Position"). Each ancestor in the trail is clickable, allowing users to jump directly to any level without repeatedly pressing Back/Escape.

---

## Problem Statement

The current modal stack only shows a "← Back" button that pops one level. When users are 3+ levels deep (e.g., Settings → Badge Style → Position Picker), returning to Settings requires pressing Back twice. There's no visual indication of where the user is in the navigation hierarchy.

---

## User Stories

- As a user 3 levels deep in sub-modals, I want to click "Settings" in the breadcrumb to jump back directly without pressing Back twice.
- As a user exploring settings, I want to see the navigation path so I know where I am in the modal hierarchy.
- As a user in a sub-modal, I want the breadcrumb to show which parent modal led me here.

---

## UX Design

### Breadcrumb Bar

Replaces the current `← Back` button with a breadcrumb when depth ≥ 2:

```
┌──────────────────────────────────┐
│ Settings › Badge Style › Position│
│ Badge Position                   │
│ Where the countdown timer appears│
│ ┌────────┬────────┬────────────┐ │
│ │ ↖ Top  │ ↑ Top  │ ↗ Top     │ │
│ │ Left   │ Center │ Right     │ │
│ ├────────┼────────┼────────────┤ │
│ │ ↙ Bot  │ ↓ Bot  │ ↘ Bot  ✓  │ │
│ │ Left   │ Center │ Right     │ │
│ └────────┴────────┴────────────┘ │
└──────────────────────────────────┘
```

### Behavior

- **Depth 0** (root modal like Settings): no breadcrumb, no back button (current behavior)
- **Depth 1** (one sub-modal): show `← Back` as today (no breadcrumb — only one ancestor, not useful)
- **Depth ≥ 2**: show breadcrumb trail replacing the back button. Format: `Ancestor1 › Ancestor2 › Current`
- Each ancestor segment is clickable — clicking pops the stack down to that level
- Current modal name (last segment) is displayed but not clickable
- Separator: ` › ` (thin right-pointing arrow, `\u203A`)
- Breadcrumb text uses `ar-back-btn` styling (small, muted color)

### Settings Integration

No new Config keys. Breadcrumb is derived from the modal stack at render time.

---

## Technical Design

### Data Model

The modal stack already stores `entry.id` for each level. Modal definitions already have `title` (function or string). The breadcrumb reads titles from the stack.

### Core Logic

In `_addChrome()`:
1. Check `stack.length` — if ≥ 2, render breadcrumb instead of back button
2. Build breadcrumb from `stack.map(e => defs[e.id].title)` + current modal title
3. Each ancestor segment is a `<button>` that calls `pop()` N times (or uses `replace` logic to jump)
4. Current segment is a `<span>` (not clickable)

### Integration Points

- `_addChrome()` in the Modal framework — the only change point
- Uses existing `ar-back-btn` CSS class for ancestor links
- Must handle `title` being a function (call it) or string

---

## Edge Cases & Error Handling

- Modal titles that are functions: call them to get the string
- Very long breadcrumb trails (4+ levels): allow horizontal overflow with `text-overflow: ellipsis` on the container
- Clicking an ancestor while cleanups are pending: the existing `pop()` cleanup chain handles this

---

## Scope & Non-Goals

### In Scope
- Breadcrumb bar in `_addChrome()` for depth ≥ 2
- Clickable ancestors that jump to that stack level
- Derives titles from modal definitions

### Out of Scope (Future)
- Breadcrumb in depth-1 sub-modals (back button is sufficient)
- Custom breadcrumb labels (always uses modal title)
- Breadcrumb persistence across modal reopens

---

## Implementation Details

**Version**: 4.2.0
**Date**: 2026-04-14
**Action Plan**: [action-plans/features-48-52.md](../action-plans/features-48-52.md)

### What Was Built
- Breadcrumb navigation bar in `_addChrome()` for modal depth >= 2
- Each ancestor in the stack is a clickable `<button>` with class `ar-breadcrumb-link`
- Current modal name shown as non-clickable `<span>` with class `ar-breadcrumb-current`
- Separator uses thin right-pointing arrow (U+203A)
- Clicking an ancestor pops the stack down to reveal that modal
- Depth 1 retains the simple back button

### Deviations from Spec
- Breadcrumb click handlers compute pop depth at click time, not render time, because `_addChrome()` runs before the current modal is pushed to the stack

### Code Location
| Component | Location |
|-----------|----------|
| Breadcrumb CSS | Lines 1335-1339 |
| `_addChrome()` breadcrumb logic | Lines 2124-2142 |

### Testing Notes
- Verified: Settings > Badge Style > Position shows breadcrumb
- Verified: clicking `Settings'' in breadcrumb jumps directly back
- Verified: depth 1 shows back button, depth 0 shows nothing
- Zero console errors

### Screenshots
![Modal Breadcrumb Trail](images/modal-breadcrumb-trail.png)
