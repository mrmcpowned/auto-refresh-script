# Feature Spec: Confirmation Toasts with Undo

## Overview

Enhance destructive action toasts (watch removed, all watches cleared) to include a timed "Undo" button. The action is committed immediately but can be reversed within a 5-second window by clicking Undo on the toast. This gives users a safety net for accidental deletions without adding friction via confirmation dialogs.

---

## Problem Statement

Currently, removing a watch or clearing all watches is irreversible the moment the user clicks. The clear-all button has a two-click confirmation, but single watch removal is instant. Users who accidentally remove a watch have no recourse — they must re-pick the element and re-configure the watch mode.

---

## User Stories

- As a user who accidentally removed a watch, I want to click "Undo" on the toast to restore it within 5 seconds.
- As a user who cleared all watches intentionally, I don't want the undo toast to block my workflow — it should auto-dismiss.
- As a user, I want the undo toast to be visually distinct so I notice the option before it disappears.

---

## UX Design

### Undo Toast

```
┌──────────────────────────────────────────────┐
│  Watch removed (2 remaining)    [ Undo ]     │
└──────────────────────────────────────────────┘
```

### Behavior

- Toast appears with the same styling as current toasts but includes an "Undo" button on the right
- Timer: 5 seconds (longer than the standard 3s toast)
- Progress indicator: a shrinking bar at the bottom of the toast showing remaining time
- Clicking "Undo": restores the deleted data, shows a confirmation toast ("Watch restored"), and refreshes the current modal if applicable
- After 5 seconds: toast fades out, undo data is discarded
- If user opens a modal or performs another action during the undo window, the undo remains available

### Actions That Support Undo

| Action | Undo Behavior |
|--------|--------------|
| Single watch removed | Re-add the watch with all original fields |
| All watches cleared | Restore the full watches array |
| Domain watches removed (overview) | Restore remote watches for that domain |

### Actions That Do NOT Support Undo

- Settings changes (theme, interval, etc.) — these are easily re-changeable
- Webhook deletion — already has two-click confirmation

### Settings Integration

No new Config keys.

---

## Technical Design

### Data Model

```javascript
// Undo state (held in closure, not persisted)
{
    type: 'watch-removed' | 'watches-cleared' | 'domain-cleared',
    data: { /* snapshot of removed data */ },
    timer: timeoutId,
    toastEl: HTMLElement
}
```

### Core Logic

1. Create `showUndoToast(message, undoFn, timeout = 5000)` — a variant of `showToast` that:
   - Creates a toast with message text + an "Undo" `<button>`
   - Adds a progress bar that shrinks over `timeout` ms
   - On click: calls `undoFn()`, removes toast, shows "Restored" toast
   - On timeout: removes toast, discards the undo closure
2. At each removal site, capture the data before deleting, then pass a restore function as `undoFn`

### Integration Points

- `WatchStore.remove()` call sites in clear-watch modal and context menu
- `WatchStore.clearAll()` call site
- Watch overview domain removal
- New toast CSS: `.ar-toast-undo` with button styling and progress bar
- The toast element needs `pointer-events: auto` (current toasts have `pointer-events: none`)

### I18N Keys

- `toast.undo`: "Undo"
- `toast.watchRestored`: "Watch restored"
- `toast.watchesRestored`: "Watches restored"

---

## Edge Cases & Error Handling

- Multiple undos pending: each undo toast is independent; undoing one doesn't affect others
- User removes a watch then immediately re-adds the same selector: undo should not conflict (check by ID)
- Page navigates away during undo window: undo is lost (acceptable — page refresh clears all state)
- Modal re-render after undo: if settings modal is open, it should re-render to show the restored watch

---

## Scope & Non-Goals

### In Scope
- `showUndoToast()` function with timed undo callback
- Undo for single watch removal, clear-all, and domain removal
- Progress bar on undo toast
- I18N for undo-related strings

### Out of Scope (Future)
- Undo for settings changes
- Undo for webhook deletion
- Multi-level undo (undo stack)
- Persistent undo across page refresh

---

## Implementation Details

**Version**: 4.2.0
**Date**: 2026-04-14
**Action Plan**: [action-plans/features-48-52.md](../action-plans/features-48-52.md)

### What Was Built
- `showUndoToast(message, undoFn, timeout)` function with Undo button and progress bar
- Undo support for single watch removal (clear-watch modal + context menu)
- Undo support for clear-all watches
- Undo support for domain removal in watch overview
- Removed direct toast from `WatchStore.clearAll()` since callers handle undo toast
- CSS classes: `.ar-toast-undo`, `.ar-toast-undo-btn`, `.ar-toast-progress`

### Deviations from Spec
- `WatchStore.clearAll()` no longer shows its own toast; the caller provides the undo toast
- Domain removal undo restores watches by re-serializing to their original GM storage keys

### Code Location
| Component | Location |
|-----------|----------|
| `showUndoToast()` | Line ~1781 |
| Toast CSS | Lines 1326-1329 |
| I18N keys | Lines 583-585 |
| Clear-watch undo | Lines 3120-3165 |
| Context menu undo | Lines 4030-4040 |
| Domain removal undo | Lines 3860-3890 |

### Testing Notes
- Verified: removing watch via context menu shows undo toast with button + progress bar
- Verified: toast auto-dismisses after 5 seconds
- Verified: undo button is clickable and triggers restore
- Zero console errors

