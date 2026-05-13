# Implementation Plan: Settings Reset to Defaults (Feature #56)

## Version Target: 4.6.0

## Overview
Add a "Reset to Defaults" button at the bottom of the "More settings" section in the settings modal. Uses two-click confirmation (matching Clear All watches pattern) and an undo toast with 5-second window. Resets all CONFIG_SCHEMA values to their factory defaults.

## Implementation Steps

### Step 1: Add English I18N Keys
**Location**: I18N.en section, after existing toast keys (~line 589)
- `setting.resetDefaults` — button label: `♻ Reset to Defaults`
- `setting.resetDefaults.sub` — subtitle: `Restore all settings to factory defaults`
- `btn.resetConfirm` — confirmation text: `♻ Click again to confirm`
- `toast.settingsReset` — toast message: `All settings reset to defaults`
- `toast.settingsRestored` — undo result: `Settings restored`

### Step 2: Add Spanish I18N Keys
**Location**: I18N.es section, after existing toast keys (~line 966)
- Same keys with Spanish translations

### Step 3: Add Reset Button to Settings Modal
**Location**: Settings modal build function, after webhookBtn at ~line 3993
- Add `h('div', { class: 'ar-divider' })` to moreWrapper
- Create reset button with `makeOptionBtn()` using `{ bg: T.errBg, color: T.errLight }` for destructive styling
- Add button to `filterables` array for search integration

### Step 4: Implement Two-Click Confirmation + Reset Logic
**Location**: Inside the reset button's click handler
- Boolean flag `resetConfirmPending`
- First click: change text to `btn.resetConfirm`, darken background (T.errBgDark)
- 3-second timeout to revert
- Second click:
  1. Snapshot all current config values
  2. Iterate CONFIG_SCHEMA → Config.set(name, schema.default) for each
  3. Stop active refresh via RefreshService.stop()
  4. Reopen settings modal via Modal.open('settings')
  5. Show undo toast with snapshot restore function

## Key Design Decisions
- Reuses existing two-click confirmation pattern from Clear All watches
- Reuses showUndoToast for consistency with Feature #50
- Skips `settingsExpanded` from reset (keep expanded state as-is since user is in settings)
- All config changes fire config:changed events automatically via Config.set()

## Testing Plan
1. Two-click confirmation: first click changes text, second click resets
2. 3-second timeout reverts button if no second click
3. All CONFIG_SCHEMA values reset to defaults after confirmation
4. Active refresh is stopped after reset
5. Settings modal refreshes to show default values
6. Undo toast appears with 5-second window
7. Undo restores all previous values
8. Search filter finds button via "reset"
9. Keyboard navigation reaches the button
10. No console errors

## Deviations from Spec
- Skipped `settingsExpanded` from reset to preserve the user's current expanded view while in the settings modal

## Status: COMPLETED
**Version**: 4.6.0
**Date**: 2026-05-13
