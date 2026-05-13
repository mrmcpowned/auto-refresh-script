# Implementation Plan: Settings Layout Overhaul (Feature #30)

## Version Target: 2.2.0

## Overview
Restructure the settings modal with progressive disclosure (More/Fewer settings toggle) and a grouped Badge Style sub-page. Default view shows toggle, interval, and watches. Hidden sections contain badge appearance, theme, and general settings.

## Implementation Steps

### Step 1: Add storage key
**Location**: Storage keys section (~line 166)
- Add `STORAGE_KEY_SETTINGS_EXPANDED = 'autoRefreshSettingsExpanded'`

### Step 2: Add CSS class
**Location**: `buildCss()` (~line 370 area)
- Add `.ar-more-link` class for the expand/collapse toggle

### Step 3: Define `badge-style` modal
**Location**: After existing modal definitions, before `settings` modal (~line 2100 area)
- New `Modal.define('badge-style', ...)` with 3 buttons: Position, Font Size, Opacity

### Step 4: Restructure `settings` modal
**Location**: `Modal.define('settings', ...)` (~line 2103-2295)
- Keep: status bar, toggle, interval button (no section header)
- Keep: watches section with all watch buttons
- Add: "More settings" link after watches
- Wrap in hidden div: Badge & Appearance section (Badge Style + Theme), General section (Shortcut, Alert Mode, Webhook)
- Persist expand/collapse state

## Key Design Decisions
- Interval stays top-level (most-changed setting)
- Badge Position/Font Size/Opacity grouped into Badge Style sub-page
- "Refresh" section header removed; interval is self-explanatory at the top
- Expand/collapse state persisted so power users don't re-expand each time
- Stop Alert button stays in always-visible area (urgent action)

## Testing Plan
1. Open settings — should show collapsed view (toggle, interval, watches, more link)
2. Click "More settings" — should reveal Badge & Appearance + General sections
3. Close and reopen — should remember expanded state
4. Click "Badge Style" — should open sub-page with Position, Font Size, Opacity
5. Navigate Position → pick → returns to Badge Style → Esc → returns to settings
6. Click "Fewer settings" — should collapse, persist state
7. Verify all existing sub-modals still work (theme, hotkey, alerts, webhook)
8. Verify no watches scenario shows empty state correctly
9. Check Stop Alert button appears when alert is active

## Status: COMPLETED

**Version**: 2.2.0
**Date**: 2026-04-12
**Snapshot**: `versions/v2.2.0-settings-layout-overhaul.user.js`

## Deviations from Spec
- `updateExpanded()` uses two `<span>` elements for collapsed link text instead of a single string, enabling per-segment color styling
- Added `getBadgeLabels()` helper during code quality audit to deduplicate badge label formatting
