# Feature Spec: Keyboard Shortcut Cheat Sheet

## Overview

Add a "?" hotkey that opens a lightweight overlay listing all available keyboard shortcuts with their current bindings. This provides discoverability for keyboard navigation that currently requires reading documentation or experimenting.

---

## Problem Statement

The userscript has several keyboard interactions (global hotkey, Escape to close/go back, ArrowUp/Down for focus navigation, Enter to activate, Ctrl+Right-click for context menu) but none of these are documented in-app. Users discover them by accident or not at all. The footer shows the global hotkey but nothing else.

---

## User Stories

- As a new user, I want to press "?" to see what keyboard shortcuts are available so I can use the app more efficiently.
- As a user who changed the global hotkey, I want the cheat sheet to show my custom binding, not the default.
- As a user with a modal open, I want "?" to overlay the shortcut list without disrupting my current modal state.

---

## UX Design

### Cheat Sheet Overlay

A simple overlay panel (not a full modal — no stack interaction) showing shortcuts in a two-column layout:

```
┌──────────────────────────────────────┐
│  ⌨ Keyboard Shortcuts                │
│                                      │
│  Alt+Shift+R    Open settings        │
│  Escape         Close / go back      │
│  ↑ / ↓          Navigate options     │
│  Enter          Select option        │
│  Ctrl+Right     Quick watch menu     │
│                                      │
│  Press any key to dismiss            │
└──────────────────────────────────────┘
```

### Behavior

- **Trigger**: Press `?` (Shift+/) when NO modal is open and NO input is focused
- Ignore `?` if a modal is open (to avoid conflict with text input in modals)
- Overlay covers the screen with a semi-transparent backdrop (like modals)
- **Dismiss**: any keypress, click anywhere, or Escape
- The global hotkey row shows the CURRENT binding from `Config.get('hotkey')`, not hardcoded
- Not a modal — does not enter the modal stack, does not pause refresh

### Shortcut Entries

| Shortcut | Description | I18N Key |
|----------|-------------|----------|
| `{hotkey}` | Open settings | `shortcuts.openSettings` |
| `Escape` | Close / go back | `shortcuts.escape` |
| `↑ / ↓` | Navigate options | `shortcuts.navigate` |
| `Enter` | Select option | `shortcuts.select` |
| `Ctrl+Right-click` | Quick watch menu | `shortcuts.contextMenu` |

### Settings Integration

No new Config keys. The cheat sheet is read-only and derives the global hotkey from Config.

---

## Technical Design

### Core Logic

1. Add a `keydown` listener on `document` that checks for `?` (key === '?' or key === '/' with shiftKey)
2. Guard: skip if `Modal.isOpen()` or if `document.activeElement` is an input/textarea
3. Create overlay element, append to `_shadow`, render shortcut rows
4. On any keydown/click: remove overlay

### CSS

- `.ar-shortcut-overlay`: full-screen overlay with backdrop
- `.ar-shortcut-panel`: centered panel with the shortcut list
- `.ar-shortcut-row`: flexbox row with key + description
- Reuse `.ar-kbd` class for key display

### I18N Keys

```
'shortcuts.title':        'Keyboard Shortcuts'
'shortcuts.openSettings': 'Open settings'
'shortcuts.escape':       'Close / go back'
'shortcuts.navigate':     'Navigate options'
'shortcuts.select':       'Select option'
'shortcuts.contextMenu':  'Quick watch menu'
'shortcuts.dismiss':      'Press any key to dismiss'
```

### Integration Points

- New document-level `keydown` listener (alongside the existing hotkey listener)
- Reads `Config.get('hotkey')` for the dynamic shortcut display
- Uses `_shadow` for DOM injection (inside shadow DOM for CSS isolation)
- Uses `h()` DOM builder and `.ar-kbd` CSS class

---

## Edge Cases & Error Handling

- `?` pressed while typing in a form on the page: the listener should check `document.activeElement.tagName` and skip if it's INPUT, TEXTAREA, or contentEditable
- `?` pressed while shadow DOM input is focused (e.g., hotkey picker): `Modal.isOpen()` guard handles this
- Multiple rapid `?` presses: only one overlay at a time (remove existing before creating new)

---

## Scope & Non-Goals

### In Scope
- `?` hotkey to show/dismiss shortcut overlay
- Dynamic hotkey display from Config
- I18N translations for all shortcut descriptions
- Shadow DOM rendering with CSS isolation

### Out of Scope (Future)
- Customizable shortcuts (only the global hotkey is customizable currently)
- Shortcut hints inline in modals (e.g., "Esc" label on back buttons)
- Touch gesture documentation

---

## Implementation Details

**Version**: 4.2.0
**Date**: 2026-04-14
**Action Plan**: [action-plans/features-48-52.md](../action-plans/features-48-52.md)

### What Was Built
- `?` hotkey listener that opens a shortcut overlay (not a modal)
- Guard: ignored when modal is open or input/textarea is focused
- Shows 5 shortcuts with dynamic hotkey from `Config.get('hotkey')`
- Dismiss on any key or click (with proper listener cleanup)
- CSS classes: `.ar-shortcut-overlay`, `.ar-shortcut-panel`, `.ar-shortcut-row`, `.ar-shortcut-title`, `.ar-shortcut-desc`
- Reuses existing `.ar-kbd` class for key display

### Deviations from Spec
- None

### Code Location
| Component | Location |
|-----------|----------|
| `initShortcutCheatSheet()` IIFE | Line ~4355 |
| CSS classes | Lines 1330-1334 |
| I18N keys (shortcuts.*) | Lines 590-596 |

### Testing Notes
- Verified: `?` shows overlay with all 5 shortcuts
- Verified: `?` blocked when modal is open
- Verified: any key dismisses the overlay
- Verified: dynamic hotkey display matches current config
- Zero console errors

### Screenshots
![Keyboard Shortcut Cheat Sheet](images/keyboard-shortcut-cheatsheet.png)
