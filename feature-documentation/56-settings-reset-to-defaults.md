# Feature Spec: Settings Reset to Defaults

## Overview

A one-click "Reset All Settings" button in the settings modal that restores every configuration value to its factory default, with a confirmation step and undo toast for safety. This gives users an easy escape hatch when they've over-customized or misconfigured their setup.

---

## Problem Statement

Users who experiment with many settings (theme, hotkey, alert mode, badge style, webhook config, etc.) can end up in a confusing state with no easy way to get back to a known-good baseline. Currently, the only option is to manually revert each setting individually, which is tedious and error-prone since users may not remember the original defaults.

---

## User Stories

- As a user who has over-customized my settings, I want a single button to reset everything so I can start fresh.
- As a new user exploring features, I want confidence that I can always undo my experiments and return to defaults.
- As a user who accidentally changed something, I want an undo window after resetting so I can recover if I hit the button by mistake.

---

## UX Design

### Settings Modal Integration

A "Reset to Defaults" button appears at the bottom of the "More settings" section, visually separated from other options with a divider:

```
┌──────────────────────────────────────────┐
│  ⚙ More settings                        │
│  ─────────────────────────────────       │
│  🏷 Badge Style          bottom-right…   │
│  🎨 Theme                Dark            │
│  ─────────────────────────────────       │
│  ⌨ Hotkey                Alt+Shift+R     │
│  🔔 Alert Mode           Beep            │
│  🌐 Language             Auto            │
│  🌐 Webhook              None            │
│  ─────────────────────────────────       │
│  ♻ Reset to Defaults                     │  ← new button (red/destructive style)
└──────────────────────────────────────────┘
```

### Two-Click Confirmation Pattern

Follows the same two-click pattern used by "Clear All" watches:
1. First click: Button text changes to "♻ Click again to confirm" with darker red background
2. Second click (within 3 seconds): Executes the reset
3. If no second click within 3s: Reverts to original text

### Undo Toast

After reset executes:
- Shows undo toast: "All settings reset to defaults" with Undo button
- 5-second undo window (consistent with Feature #50 confirmation toasts)
- Undo restores all previous values

### Post-Reset Behavior

- Settings modal refreshes to show default values
- Active auto-refresh is stopped (interval changes)
- Badge updates to reflect new position/theme/font

---

## Technical Design

### Data Model

No new storage keys. This feature only resets existing `CONFIG_SCHEMA` entries to their defaults.

### Core Logic

```
1. Snapshot all current config values (for undo)
2. Iterate CONFIG_SCHEMA → Config.set(name, schema.default) for each
3. Stop any active refresh (interval changed)
4. Close modal and reopen settings (to reflect new values)
5. Show undo toast with snapshot restore function
```

### Integration Points

- **Config**: Uses existing `CONFIG_SCHEMA` iteration and `Config.set()`
- **RefreshService**: Stop active refresh since interval resets
- **Modal**: Reopen settings modal to reflect changes
- **Toast system**: Uses existing `showUndoToast()` from Feature #50
- **I18N**: New translation keys for button labels and toast messages
- **EventBus**: Config changes fire `config:changed` events automatically

### What Gets Reset

All `CONFIG_SCHEMA` entries:
- `interval` → 30
- `corner` → 'bottom-right'
- `fontSize` → 'medium'
- `hotkey` → DEFAULT_HOTKEY
- `theme` → 'dark'
- `opacity` → 1
- `alertMode` → 'beep'
- `ttsVoice` → ''
- `ttsRate` → 1.0
- `ttsVolume` → 1.0
- `webhook` → null
- `settingsExpanded` → false
- `language` → 'auto'

### What Does NOT Get Reset

- Watch configurations (those are separate from settings)
- Watch enabled/disabled state

---

## Edge Cases & Error Handling

- **Already at defaults**: Reset still works (no-op for values, still shows toast)
- **Active refresh running**: Stopped before reset, not restarted
- **Undo after modal close**: Undo toast remains visible and functional even if modal is closed
- **Rapid double-reset**: Two-click confirmation prevents accidental triggers
- **Search filter active**: Reset button is filterable like all other settings buttons

---

## Scope & Non-Goals

### In Scope
- Reset all CONFIG_SCHEMA values to defaults
- Two-click confirmation (matching existing clear-all pattern)
- Undo toast with 5-second window
- English and Spanish translations
- Button in "More settings" section with destructive styling

### Out of Scope (Future)
- Per-section reset (only reset badge settings, only reset alerts, etc.)
- Watch data reset (separate from settings reset)
- Export before reset prompt
- Reset history/audit log

---

## Risks & Open Questions

1. **Webhook config reset**: Resetting webhook to `null` clears all webhook configurations. The undo toast is the safety net.
2. **Language reset**: Resetting language to 'auto' may change the UI language, which could confuse users who set a specific language. The undo toast handles this.
---

## Implementation Details

**Version**: 4.6.0
**Date**: 2026-05-13
**Action Plan**: [action-plans/settings-reset-to-defaults.md](../action-plans/settings-reset-to-defaults.md)

### What Was Built
- "Reset to Defaults" button in the "More settings" section of the settings modal
- Two-click confirmation pattern (matching the existing clear-all watches UX)
- Full undo support via `showUndoToast()` with 5-second window
- English and Spanish translations for all new labels/toasts
- Search filter integration (button appears when searching "reset")

### Deviations from Spec
- `settingsExpanded` is excluded from reset to preserve the user's current expanded view while in the settings modal

### Code Location
| Component | Location |
|-----------|----------|
| English I18N keys | Lines ~590-596 (`toast.settingsReset`, `toast.settingsRestored`, `setting.resetDefaults`, `setting.resetDefaults.sub`, `btn.resetConfirm`) |
| Spanish I18N keys | Lines ~974-979 (same keys in `I18N.es`) |
| Reset button + logic | Lines ~4007-4050 (Settings modal `build` function, after webhook button) |

### Testing Notes
- Syntax check: PASS
- GM_* lint check: PASS (all calls inside service objects)
- Two-click confirmation: Requires manual verification
- Reset execution (all CONFIG_SCHEMA values): Requires manual verification
- Undo toast with restore: Requires manual verification
- Settings modal refresh after reset: Requires manual verification
- Search filter: Requires manual verification (found via "reset")
- Keyboard navigation: PASS (standard `<button>` element via `makeOptionBtn`)
- Console errors: Requires manual verification

### Screenshots
(Pending manual browser testing)