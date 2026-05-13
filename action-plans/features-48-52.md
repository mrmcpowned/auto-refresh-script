# Implementation Plan: Features #48–#52

## Version Target: 4.2.0

## Overview

Implement five usability features:
1. **#48 Settings Search/Filter** — search input in settings modal
2. **#49 Modal Breadcrumb Trail** — breadcrumb nav for depth ≥ 2
3. **#50 Confirmation Toasts with Undo** — undo button on destructive toasts
4. **#51 Keyboard Shortcut Cheat Sheet** — "?" overlay listing shortcuts
5. **#52 Watch Naming/Labels** — optional custom label per watch

## Implementation Steps

### Step 1: I18N Keys (en + es)
**Location**: I18N dictionaries (~lines 272–970)
Add all new keys for all 5 features:
- `filter.placeholder`, `filter.noResults`
- `breadcrumb.separator` (just use `\u203A` inline)
- `toast.undo`, `toast.watchRestored`, `toast.watchesRestored`
- `shortcuts.title`, `shortcuts.openSettings`, `shortcuts.escape`, `shortcuts.navigate`, `shortcuts.select`, `shortcuts.contextMenu`, `shortcuts.dismiss`
- `watch.nameOptional`, `watch.namePlaceholder`

### Step 2: watchDisplayName() helper
**Location**: After `_truncate()` (~line 1780)
```javascript
function watchDisplayName(w, max) {
    return w.label ? _truncate(w.label, max || 30) : _truncate(w.selector, max || 30);
}
```

### Step 3: CSS additions in buildCss()
**Location**: End of buildCss() (~line 1300)
Add:
- `.ar-toast-undo` — pointer-events:auto, flex layout for message+button
- `.ar-toast-undo-btn` — undo button styling
- `.ar-toast-progress` — progress bar in toast
- `.ar-shortcut-overlay` — full-screen overlay
- `.ar-shortcut-panel` — centered panel
- `.ar-shortcut-row` — key-description row
- `.ar-breadcrumb` — breadcrumb container
- `.ar-breadcrumb-link` — clickable ancestor

### Step 4: showUndoToast() function
**Location**: After showToast() (~line 1730)
Create `showUndoToast(message, undoFn, timeout = 5000)`:
- Creates toast with message + Undo button + progress bar
- On click Undo: calls undoFn(), removes toast, shows confirmation toast
- On timeout: removes toast, discards closure

### Step 5: Settings Search/Filter (#48)
**Location**: Settings modal build() (~line 3166)
- After status bar, before toggle: add `ar-input` search field
- Collect all option buttons into an array after building them
- On `input` event: filter buttons by combined text, force-show moreWrapper when filtering

### Step 6: Modal Breadcrumb Trail (#49)
**Location**: `_addChrome()` in Modal framework (~line 2040)
- When `stack.length >= 2`: build breadcrumb from stack titles + current title
- Each ancestor is a `<button>` class `ar-breadcrumb-link`
- Current segment is `<span>`
- Clicking ancestor pops stack down to that depth

### Step 7: Undo integration in watch removal sites (#50)
**Location**: clear-watch modal (~line 2980), WatchStore.clearAll() (~line 1100), context menu (~line 3850), watch overview domain removal (~line 3700)
- At each removal site: capture data snapshot before deleting, pass restore function to showUndoToast()

### Step 8: Keyboard Shortcut Cheat Sheet (#51)
**Location**: After hotkey listener (~line 4107)
- Add `keydown` listener for `?` key
- Guard: skip if Modal.isOpen() or focused input
- Create overlay with shortcut rows
- Dismiss on any key/click

### Step 9: Watch Naming/Labels (#52)
**Location**: 
- Watch mode modal (~line 3050): add name input
- Watch inspector sidebar (~line 3360): show label
- Clear-watch modal (~line 2980): show label
- Context menu (~line 3850): show label
- Watch overview (~line 3598): show label
- Toast messages: use label when available

### Step 10: Test harness updates
Add tests for new helpers: watchDisplayName, showUndoToast

## Key Design Decisions
- Search is ephemeral — cleared on modal close
- Breadcrumb only at depth ≥ 2 (depth 1 keeps simple back button)
- Undo captures full data snapshot before deletion, restores via WatchStore.add/setLocal
- Cheat sheet is NOT a modal — just an overlay with auto-dismiss
- Watch labels are optional, empty string = no label

## Testing Plan
1. Settings search: type "theme", verify only Theme option visible
2. Search clear: press Escape in search, verify full layout restored
3. Breadcrumb: go Settings > Badge Style > Position, verify breadcrumb shows
4. Breadcrumb click: click "Settings" in breadcrumb, verify jump to settings
5. Undo toast: remove a watch, verify Undo button appears, click Undo, verify restore
6. Undo timeout: remove a watch, wait 5s, verify toast auto-dismisses
7. Shortcut cheat sheet: press ? with no modal, verify overlay
8. Cheat sheet dismiss: press any key, verify overlay removed
9. Watch naming: pick element, enter name, verify name shows in overview/inspector
10. Label fallback: pick element with no name, verify selector displays

## Deviations from Spec
- #50: Removed toast from `WatchStore.clearAll()` since callers now handle undo toast externally
- #49: Breadcrumb click handlers compute pop depth at click time (not render time) because the current modal hasn't been pushed when `_addChrome` runs
- #51: Cheat sheet dismiss listeners cleaned up together (both key and click) to prevent listener leaks
- #52: Watch overview shows labels in subtitle when available, falling back to mode list

## Status: COMPLETED
**Version**: 4.2.0
**Date**: 2026-04-14
