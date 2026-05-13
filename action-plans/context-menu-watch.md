# Implementation Plan: Quick Watch via Context Menu (Feature #18)

## Version Target: 1.6.0

## Overview
Add Ctrl+Right-Click context menu to instantly add a watch on any element, bypassing the full element picker flow.

## Implementation Steps

### Step 1: Add `showQuickWatchMenu()` function
**Location**: After `startElementPicker()` (~line 1522), before `// --- Watch Checking ---`

Creates a floating menu at cursor position inside shadow DOM with:
- Header showing selector of right-clicked element
- Three mode buttons: Text Content, Styling, Both
- "Full Options..." link that opens watch-mode modal
- Click-away and Escape dismissal
- For already-watched elements: show Re-snapshot / Remove / Inspect options instead

**CSS classes needed**: Add to `_css` stylesheet:
- `.ar-ctx-menu` — fixed-position menu container
- `.ar-ctx-header` — header with selector display

### Step 2: Add `contextmenu` event listener
**Location**: Near the keyboard shortcut handler (~line 1628), before `GM_registerMenuCommand`

```javascript
document.addEventListener('contextmenu', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    const target = e.target;
    const selector = getUniqueSelector(target);
    showQuickWatchMenu(e.clientX, e.clientY, target, selector);
}, true);
```

### Step 3: Handle already-watched elements
When user Ctrl+Right-Clicks an element that already has a watch:
- Show "Already watching" header with status (ok/changed)
- Re-snapshot button
- Remove button
- Inspect button (opens watch inspector)

### Step 4: Version bump
Bump 1.5.1 → 1.6.0 in both `@version` and `VERSION` constant.

## Key Design Decisions
- Menu renders in shadow DOM (`_shadow`) for CSS isolation
- Uses existing `h()` helper and `makeOptionBtn()` for buttons
- Uses existing `addWatch()` which handles upserts
- Reuses `captureStyles()`, `getUniqueSelector()`, `getWatches()`, `getWatchStatus()`
- Click-away listener added with `setTimeout(..., 0)` to avoid immediate dismiss
- Menu positioned at `clientX/clientY` with viewport clamping
- No new storage keys needed

## Testing Plan
1. Ctrl+Right-Click on counter element → quick menu appears
2. Click "Text Content" → watch added, toast shown
3. Ctrl+Right-Click on already-watched element → shows already-watching menu
4. Click Re-snapshot → snapshot updated
5. Click Remove → watch removed
6. Regular right-click → normal browser context menu (no interference)
7. Click away from menu → menu dismissed
8. Escape from menu → menu dismissed
